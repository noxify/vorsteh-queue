/**
 * Worker class (Consumer).
 *
 * Responsible for polling jobs, executing handlers, managing concurrency,
 * retries, timeouts, cancellation, DLQ routing, and cron rescheduling.
 *
 * @example
 * ```typescript
 * const worker = new Worker(adapter, { name: "my-queue", concurrency: 5 })
 *
 * worker.register("send-email", async (job, { signal }) => {
 *   await sendEmail(job.payload.to, { signal })
 *   return { sent: true }
 * })
 *
 * worker.start()
 * ```
 */

import {
  areDependenciesMet,
  cascadeDependencyFailure,
  getFailedDependency,
} from "./dependencies"
import { TypedEventEmitter } from "./events"
import { RateLimiterRegistry } from "./rate-limiter"
import { calculateRetryDelay, DEFAULT_RETRY_STRATEGY } from "./retry"
import { createStepContext, SleepInterrupt, WaitForInterrupt } from "./steps"
import type { Telemetry, TelemetrySpan } from "./telemetry"
import { noopTelemetry } from "./telemetry"
import type {
  BatchHandlerOptions,
  BatchJobHandler,
  GetNextJobOptions,
  HandlerOptions,
  Job,
  JobContext,
  JobHandler,
  StepState,
  JobWithProgress,
  QueueAdapter,
  TriggerConfig,
  WorkerConfig,
  WorkerEvents,
} from "./types"
import { serializeError } from "./utils/error"
import { calculateNextRun } from "./utils/scheduler"

interface RegisteredHandler {
  readonly handler: JobHandler
  readonly options: HandlerOptions
}

interface RegisteredBatchHandler {
  readonly handler: BatchJobHandler
  readonly options: BatchHandlerOptions
}

interface ActiveJob {
  readonly controller: AbortController
  readonly promise: Promise<void>
  readonly handlerName: string
  readonly span: TelemetrySpan
}

export class Worker extends TypedEventEmitter<WorkerEvents> {
  private readonly adapter: QueueAdapter
  private readonly config: Required<
    Pick<WorkerConfig, "name" | "concurrency" | "pollInterval">
  > &
    WorkerConfig
  private readonly telemetry: Telemetry

  private readonly handlers = new Map<string, RegisteredHandler>()
  private readonly batchHandlers = new Map<string, RegisteredBatchHandler>()
  private readonly activeJobs = new Map<string, ActiveJob>()
  private readonly rateLimiters = new RateLimiterRegistry()
  private readonly triggers: TriggerConfig[] = []

  private running = false
  private paused = false
  private pollTimer: ReturnType<typeof setTimeout> | undefined

  constructor(adapter: QueueAdapter, config: WorkerConfig) {
    super()
    this.adapter = adapter
    this.config = {
      concurrency: 1,
      pollInterval: 100,
      ...config,
    }
    this.telemetry = config.telemetry ?? noopTelemetry

    this.adapter.setQueueName(this.config.name)
  }

  /**
   * Register a single-job handler.
   *
   * @param name - Job type name (must be unique per worker)
   * @param handler - Function to process jobs of this type
   * @param options - Per-handler options (concurrency, rate limit)
   * @throws {Error} If a handler with this name is already registered
   *
   * @example
   * ```typescript
   * worker.register("send-email", async (job, { signal }) => {
   *   await sendEmail(job.payload.to, { signal })
   *   return { sent: true }
   * }, { concurrency: 3 })
   * ```
   */
  register<TPayload, TResult>(
    name: string,
    handler: JobHandler<TPayload, TResult>,
    options: HandlerOptions = {}
  ): void {
    if (this.handlers.has(name) || this.batchHandlers.has(name)) {
      throw new Error(`Handler for "${name}" is already registered`)
    }
    this.handlers.set(name, { handler: handler as JobHandler, options })
    if (options.rateLimit) {
      this.rateLimiters.register(name, options.rateLimit)
    }
  }

  /**
   * Register a batch handler.
   *
   * @param name - Job type name (must be unique per worker)
   * @param handler - Function to process batches of jobs
   * @param options - Batch options (minSize, maxSize, waitFor, concurrency)
   * @throws {Error} If a handler with this name is already registered
   *
   * @example
   * ```typescript
   * worker.registerBatch("index-documents", async (jobs, { signal }) => {
   *   const results = await bulkIndex(jobs.map(j => j.payload), { signal })
   *   return results
   * }, { maxSize: 50, waitFor: 5000 })
   * ```
   */
  registerBatch<TPayload, TResult>(
    name: string,
    handler: BatchJobHandler<TPayload, TResult>,
    options: BatchHandlerOptions = {}
  ): void {
    if (this.handlers.has(name) || this.batchHandlers.has(name)) {
      throw new Error(`Handler for "${name}" is already registered`)
    }
    this.batchHandlers.set(name, {
      handler: handler as BatchJobHandler,
      options,
    })
  }

  /**
   * Start processing jobs.
   */
  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    this.paused = false
    this.emit("worker:started", undefined) // eslint-disable-line unicorn/no-useless-undefined
    this.pollTimer = setTimeout(() => void this.poll(), 0)
  }

  /**
   * Stop processing (graceful — waits for active jobs to complete).
   */
  async stop(): Promise<void> {
    this.running = false

    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = undefined
    }

    // Wait for all active jobs to finish
    const activePromises = [...this.activeJobs.values()].map((aj) => aj.promise)
    await Promise.allSettled(activePromises)

    this.emit("worker:stopped", undefined) // eslint-disable-line unicorn/no-useless-undefined
  }

  /**
   * Pause processing (jobs still enqueue, not picked).
   */
  pause(): void {
    this.paused = true
  }

  /**
   * Resume processing after pause.
   */
  resume(): void {
    this.paused = false
  }

  /** Check if the worker is currently running */
  get isRunning(): boolean {
    return this.running
  }

  /** The queue name this worker consumes from */
  get name(): string {
    return this.config.name
  }

  /** Number of currently active (in-flight) jobs */
  get activeJobCount(): number {
    return this.activeJobs.size
  }

  /**
   * Cancel a specific job being processed by this worker.
   *
   * @param jobId - ID of the job to cancel
   * @param reason - Optional cancellation reason
   */
  async cancelJob(jobId: string, reason?: string): Promise<void> {
    const active = this.activeJobs.get(jobId)
    if (active) {
      active.controller.abort(reason ?? "cancelled")
    }
    await this.adapter.cancelJob(jobId, reason)
  }

  // ─── Internal Polling ──────────────────────────────────────

  private async poll(): Promise<void> {
    if (!this.running) {
      return
    }

    if (!this.paused && this.activeJobs.size < this.config.concurrency) {
      try {
        await this.pickAndProcessJobs()
      } catch (error) {
        this.emit("worker:error", error)
      }
    }

    this.pollTimer = setTimeout(
      () => void this.poll(),
      this.config.pollInterval
    )
  }

  private async pickAndProcessJobs(): Promise<void> {
    const available = this.config.concurrency - this.activeJobs.size
    if (available <= 0) {
      return
    }

    // Determine active groups from current jobs
    const activeGroups = this.getActiveGroups()

    // Process batch handlers first
    for (const [name, { handler, options }] of this.batchHandlers) {
      if (this.activeJobs.size >= this.config.concurrency) {
        break
      }
      if (!this.canRunHandler(name)) {
        continue
      }

      const maxSize = options.maxSize ?? 10
      // eslint-disable-next-line no-await-in-loop
      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential polling per handler is intentional
      const jobs = await this.adapter.getNextJobsForHandler(
        name,
        maxSize,
        activeGroups
      )

      // Filter out jobs with unmet dependencies
      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- must resolve before processing
      const eligibleJobs = await this.filterByDependencies(jobs)

      const minSize = options.minSize ?? 1
      if (eligibleJobs.length >= minSize) {
        void this.processBatch(name, eligibleJobs, handler, options)
      }
    }

    // Process single handlers
    const singleHandlerNames = [...this.handlers.keys()]
    if (singleHandlerNames.length === 0) {
      return
    }

    // Track which handlers are excluded (at capacity or rate-limited) during this pick cycle
    const excludedHandlers = new Set<string>()

    while (this.activeJobs.size < this.config.concurrency) {
      const eligibleHandlers = singleHandlerNames.filter(
        (name) => !excludedHandlers.has(name)
      )
      if (eligibleHandlers.length === 0) {
        break
      }

      const currentActiveGroups = this.getActiveGroups()
      const getOptions: GetNextJobOptions = {
        activeGroups: currentActiveGroups,
        handlerNames: eligibleHandlers,
      }

      // eslint-disable-next-line no-await-in-loop
      const job = await this.adapter.getNextJob(getOptions)
      if (!job) {
        break
      }

      const registered = this.handlers.get(job.name)
      if (!registered) {
        // Handler unregistered mid-cycle — exclude and retry with remaining handlers
        excludedHandlers.add(job.name)
        continue
      }

      if (!this.canRunHandler(job.name)) {
        // Handler at capacity or rate-limited — exclude and retry with remaining handlers
        excludedHandlers.add(job.name)
        continue
      }

      // Check dependency-gating
      // eslint-disable-next-line no-await-in-loop
      const [eligible] = await this.filterByDependencies([job])
      if (!eligible) {
        continue
      }

      void this.processJob(eligible, registered.handler)
    }
  }

  // ─── Job Processing ────────────────────────────────────────

  private processJob(job: Job, handler: JobHandler): Promise<void> {
    const controller = new AbortController()
    const { signal } = controller

    this.trackGroupKey(job)

    // Start telemetry span for this job
    const span = this.telemetry.jobStarted(job)
    const promise = this.telemetry.withSpan(span, () =>
      this.executeJob(job, handler, controller, signal, span)
    )

    this.activeJobs.set(job.id, {
      controller,
      handlerName: job.name,
      promise,
      span,
    })

    return promise
  }

  private async executeJob(
    job: Job,
    handler: JobHandler,
    controller: AbortController,
    signal: AbortSignal,
    span: TelemetrySpan
  ): Promise<void> {
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined
    let runCompensations: (() => Promise<void>) | undefined

    try {
      // Mark as processing
      await this.adapter.updateJobStatus(job.id, { status: "processing" })

      // Only increment attempts for genuine new executions, not step resumptions.
      // A job resuming from step.sleep()/step.waitFor() already has steps in progress.
      const isStepResumption =
        job.steps !== undefined &&
        job.steps.length > 0 &&
        job.steps.some(
          (s) => s.status === "completed" || s.status === "running"
        )
      if (!isStepResumption) {
        await this.adapter.incrementJobAttempts(job.id)
      }

      const processingJob: Job = {
        ...job,
        attempts: isStepResumption ? job.attempts : job.attempts + 1,
        status: "processing",
      }
      this.emit("job:processing", processingJob)

      // Set up timeout
      const { timeout } = job
      if (timeout !== false && timeout !== undefined && timeout > 0) {
        timeoutTimer = setTimeout(() => controller.abort("timeout"), timeout)
      }

      // Create job context with steps
      const stepCtx = this.createJobContext(signal, processingJob)
      const { ctx } = stepCtx
      ;({ runCompensations } = stepCtx)

      // Create job with progress
      const jobWithProgress = this.createJobWithProgress(processingJob)

      // Execute handler
      const result = await handler(jobWithProgress, ctx)

      // Success
      await this.adapter.updateJobStatus(job.id, {
        result,
        status: "completed",
      })
      const completedJob: Job = {
        ...processingJob,
        completedAt: new Date(),
        processedAt: processingJob.processedAt ?? new Date(),
        result,
        status: "completed",
      }
      this.emit("job:completed", completedJob)
      this.telemetry.jobCompleted(completedJob, span)

      /* oxlint-disable react-doctor/async-parallel -- these must run sequentially (promote before triggers, triggers before schedule) */
      // Promote parent if this is a child in a flow
      await this.promoteParentIfReady(processingJob)

      // Fire event triggers
      await this.fireTriggers(completedJob, result)

      // Schedule next run for cron/recurring jobs
      await this.scheduleNextRun(processingJob)

      // Cleanup old completed jobs
      await this.cleanupAfterCompletion(completedJob)
      /* oxlint-enable react-doctor/async-parallel */
    } catch (error) {
      await this.handleJobFailure(job, error, signal, runCompensations, span)
    } finally {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer)
      }
      this.untrackGroupKey(job)
      this.activeJobs.delete(job.id)
    }
  }

  private async handleJobFailure(
    job: Job,
    err: unknown,
    signal: AbortSignal,
    runCompensations?: () => Promise<void>,
    span?: TelemetrySpan
  ): Promise<void> {
    // Handle SleepInterrupt — job pauses and resumes later
    if (err instanceof SleepInterrupt) {
      const processAt = new Date(Date.now() + err.duration)
      await this.adapter.updateJobStatus(job.id, {
        processAt,
        status: "delayed",
      })
      // SleepInterrupt is not a failure — end span without error
      span?.end()
      return
    }

    // Handle WaitForInterrupt — job waits for external signal
    if (err instanceof WaitForInterrupt) {
      const processAt = err.timeout
        ? new Date(Date.now() + err.timeout)
        : new Date(Date.now() + 86_400_000) // default: check again in 24h
      await this.adapter.updateJobStatus(job.id, {
        processAt,
        status: "delayed",
      })
      // WaitForInterrupt is not a failure — end span without error
      span?.end()
      return
    }

    // Run saga compensations before marking as failed
    if (runCompensations) {
      await runCompensations()
    }

    const currentAttempts = job.attempts + 1

    // Check if cancelled via abort
    if (signal.aborted) {
      const reason = signal.reason as string | undefined
      if (reason !== "timeout") {
        // Explicit cancellation
        await this.adapter.updateJobStatus(job.id, {
          cancellationReason: typeof reason === "string" ? reason : "cancelled",
          status: "cancelled",
        })
        this.emit("job:cancelled", {
          ...job,
          cancellationReason: typeof reason === "string" ? reason : undefined,
          status: "cancelled",
        })
        this.telemetry.jobCancelled(job.name)
        span?.end()
        return
      }
    }

    const error = serializeError(err)

    // Record failure in telemetry
    if (span) {
      this.telemetry.jobFailed(job, err, span)
    }

    // Check if retries remaining
    if (currentAttempts < job.maxAttempts) {
      // Retry: move to delayed with backoff
      const strategy = this.config.retryStrategy ?? DEFAULT_RETRY_STRATEGY
      const delay = calculateRetryDelay(strategy, currentAttempts - 1)
      const processAt = new Date(Date.now() + delay)

      await this.adapter.updateJobStatus(job.id, {
        error,
        processAt,
        status: "delayed",
      })

      const retriedJob: Job = {
        ...job,
        attempts: currentAttempts,
        error,
        status: "delayed",
      }
      this.emit("job:retried", retriedJob)
      this.emit("job:failed", { ...retriedJob, error })
      this.telemetry.jobRetried(job.name)
    } else {
      // Move to DLQ (dead)
      await this.adapter.updateJobStatus(job.id, { error, status: "dead" })
      const deadJob: Job = {
        ...job,
        attempts: currentAttempts,
        error,
        status: "dead",
      }
      this.emit("job:dead", deadJob)
      this.emit("job:failed", { ...deadJob, error })
      this.telemetry.jobDead(job.name)

      // Cascade failure to parent if configured
      await this.failParentOnChildFailure(deadJob)

      // Cascade failure to dependent jobs
      await cascadeDependencyFailure(job.id, this.adapter)

      // Cleanup old failed/dead jobs
      await this.cleanupAfterFailure()
    }
  }

  // ─── Batch Processing ──────────────────────────────────────

  private async processBatch(
    _name: string,
    jobs: readonly Job[],
    handler: BatchJobHandler,
    _options: BatchHandlerOptions
  ): Promise<void> {
    const controller = new AbortController()
    const { signal } = controller

    // Track all jobs in this batch as a single active unit
    const batchId = `batch-${Date.now()}`

    // Start telemetry spans for each job in the batch
    const spans = new Map<string, TelemetrySpan>()
    for (const job of jobs) {
      spans.set(job.id, this.telemetry.jobStarted(job))
    }

    const promise = this.executeBatch(
      jobs,
      handler,
      controller,
      signal,
      batchId,
      spans
    )

    // Register all jobs in the batch
    for (const job of jobs) {
      this.trackGroupKey(job)
      const span = spans.get(job.id)
      if (span) {
        this.activeJobs.set(job.id, {
          controller,
          handlerName: job.name,
          promise,
          span,
        })
      }
    }

    await promise
  }

  private async executeBatch(
    jobs: readonly Job[],
    handler: BatchJobHandler,
    controller: AbortController,
    signal: AbortSignal,
    _batchId: string,
    spans: Map<string, TelemetrySpan>
  ): Promise<void> {
    try {
      // Mark all as processing (sequential to maintain order guarantees)
      // Sequential updates required to maintain ordering guarantees
      for (const job of jobs) {
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential to maintain order guarantees
        await this.adapter.updateJobStatus(job.id, { status: "processing" })
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential to maintain order guarantees
        await this.adapter.incrementJobAttempts(job.id)
      }

      const processingJobs = jobs.map((j) => ({
        ...j,
        attempts: j.attempts + 1,
        status: "processing" as const,
      }))
      this.emit("batch:processing", processingJobs)

      const firstJob = processingJobs[0] ?? jobs[0]
      if (!firstJob) {
        return
      }

      const { ctx } = this.createJobContext(signal, firstJob)
      const jobsWithProgress = processingJobs.map((j) =>
        this.createJobWithProgress(j)
      )

      const results = await handler(jobsWithProgress, ctx)

      // Mark all as completed
      // eslint-disable-next-line no-await-in-loop
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i]
        if (!job) {
          continue
        }
        const result = results[i]
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential status updates per job
        await this.adapter.updateJobStatus(job.id, {
          result,
          status: "completed",
        })

        // Complete telemetry for each job
        const completedJob: Job = {
          ...job,
          completedAt: new Date(),
          result,
          status: "completed",
        }
        const span = spans.get(job.id)
        if (span) {
          this.telemetry.jobCompleted(completedJob, span)
        }
      }

      this.emit(
        "batch:completed",
        processingJobs.map((j, i) => ({
          ...j,
          result: results[i],
          status: "completed" as const,
        }))
      )
    } catch (error) {
      const serializedError = serializeError(error)

      // Mark all as failed (partial failure support would need per-job results)
      for (const job of jobs) {
        const span = spans.get(job.id)
        if (span) {
          this.telemetry.jobFailed(job, error, span)
        }
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential failure handling per job
        await this.handleJobFailure(job, error, signal)
      }

      this.emit("batch:failed", { error: serializedError, jobs: [...jobs] })
    } finally {
      for (const job of jobs) {
        this.untrackGroupKey(job)
        this.activeJobs.delete(job.id)
      }
    }
  }

  // ─── Event Triggers ─────────────────────────────────────────

  /**
   * Register an event trigger. When a job of type `on` completes,
   * automatically create a new job of type `create`.
   */
  trigger(config: TriggerConfig): this {
    this.triggers.push(config)
    return this
  }

  private async fireTriggers(job: Job, result: unknown): Promise<void> {
    for (const config of this.triggers) {
      if (config.on !== job.name) {
        continue
      }
      if (config.condition && !config.condition(result)) {
        continue
      }

      const payload = config.data(result, job)
      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- triggers must fire sequentially
      await this.adapter.addJob({
        attempts: 0,
        maxAttempts: config.options?.maxAttempts ?? 3,
        name: config.create,
        payload,
        priority: config.options?.priority ?? 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
        timeout: config.options?.timeout,
      })
    }
  }

  // ─── Flow Parent Promotion ─────────────────────────────────

  private async promoteParentIfReady(job: Job): Promise<void> {
    if (!job.parentId) {
      return
    }

    const { completed, total } = await this.adapter.incrementChildrenCompleted(
      job.parentId
    )

    if (completed >= total) {
      // All children done — promote parent to pending
      await this.adapter.updateJobStatus(job.parentId, { status: "pending" })
    }
  }

  private async failParentOnChildFailure(job: Job): Promise<void> {
    if (!job.parentId || !job.failParentOnFailure) {
      return
    }

    await this.adapter.updateJobStatus(job.parentId, {
      error: {
        message: `Child job ${job.id} (${job.name}) failed`,
        name: "ChildFailedError",
      },
      status: "failed",
    })

    // Cascade upward if parent also has a parent
    const parent = await this.adapter.getJobById(job.parentId)
    if (parent?.parentId && parent.failParentOnFailure) {
      await this.failParentOnChildFailure(parent)
    }
  }

  // ─── Cron / Recurring Scheduling ──────────────────────────

  private async scheduleNextRun(job: Job): Promise<void> {
    if (!job.cron && !job.repeatEvery) {
      return
    }
    if (job.repeatLimit && job.repeatCount >= job.repeatLimit) {
      return
    }

    const nextProcessAt = calculateNextRun({
      cron: job.cron,
      lastRun: new Date(),
      repeatEvery: job.repeatEvery,
    })

    await this.adapter.addJob({
      attempts: 0,
      cron: job.cron,
      groupKey: job.groupKey,
      maxAttempts: job.maxAttempts,
      name: job.name,
      payload: job.payload,
      priority: job.priority,
      processAt: nextProcessAt,
      progress: 0,
      repeatCount: (job.repeatCount ?? 0) + 1,
      repeatEvery: job.repeatEvery,
      repeatLimit: job.repeatLimit,
      status: "delayed",
      timeout: job.timeout,
    })
  }

  // ─── Job Cleanup ───────────────────────────────────────────

  private async cleanupAfterCompletion(job: Job): Promise<void> {
    // Flow-level cleanup: if this is a flow root completing, delete the entire flow
    if (job.flowId && !job.parentId) {
      const { removeOnComplete } = this.config
      if (removeOnComplete !== false) {
        await this.adapter.deleteFlow(job.flowId)
        return
      }
    }

    const { removeOnComplete } = this.config
    if (removeOnComplete === undefined) {
      // Default: keep 100
      await this.adapter.cleanupJobs("completed", 100)
    } else if (removeOnComplete === true) {
      await this.adapter.cleanupJobs("completed", 0)
    } else if (typeof removeOnComplete === "number") {
      await this.adapter.cleanupJobs("completed", removeOnComplete)
    }
    // removeOnComplete === false → keep all (no cleanup)
  }

  private async cleanupAfterFailure(): Promise<void> {
    const { removeOnFail } = this.config
    if (removeOnFail === undefined) {
      // Default: keep 50
      await this.adapter.cleanupJobs("failed", 50)
    } else if (removeOnFail === true) {
      await this.adapter.cleanupJobs("failed", 0)
    } else if (typeof removeOnFail === "number") {
      await this.adapter.cleanupJobs("failed", removeOnFail)
    }
    // removeOnFail === false → keep all (no cleanup)
  }

  // ─── Helpers ───────────────────────────────────────────────

  // eslint-disable-next-line class-methods-use-this
  private createJobContext(
    signal: AbortSignal,
    job: Job
  ): {
    ctx: JobContext
    getSteps: () => readonly StepState[]
    runCompensations: () => Promise<void>
  } {
    const {
      context: stepContext,
      getSteps,
      runCompensations,
    } = createStepContext(job.id, job, this.adapter)

    return {
      ctx: {
        getChildrenResults: async () => {
          const children = await this.adapter.getChildrenJobs(job.id)
          const results = new Map<string, unknown>()
          for (const child of children) {
            results.set(child.id, child.result)
          }
          return results
        },
        signal,
        step: stepContext,
      },
      getSteps,
      runCompensations,
    }
  }

  private createJobWithProgress(job: Job): JobWithProgress {
    return {
      ...job,
      updateProgress: async (value: number): Promise<void> => {
        await this.adapter.updateJobProgress(job.id, value)
        this.emit("job:progress", { ...job, progress: value })
      },
    }
  }

  private getActiveGroups(): readonly string[] {
    return [...this.activeGroupKeys]
  }

  private readonly activeGroupKeys = new Set<string>()

  /**
   * Internal: track group key when starting a job.
   * Called inside processJob before execution.
   */
  private trackGroupKey(job: Job): void {
    if (job.groupKey) {
      this.activeGroupKeys.add(job.groupKey)
    }
  }

  /**
   * Internal: untrack group key when a job finishes.
   */
  private untrackGroupKey(job: Job): void {
    if (job.groupKey) {
      this.activeGroupKeys.delete(job.groupKey)
    }
  }

  /**
   * Filter a list of jobs by dependency status.
   * Jobs with failed dependencies are cascaded based on their onDependencyFailure policy.
   * Jobs with unmet dependencies are delayed.
   * Returns only jobs eligible for processing.
   */
  private async filterByDependencies(jobs: readonly Job[]): Promise<Job[]> {
    const eligible: Job[] = []
    for (const job of jobs) {
      if (!job.dependsOn || job.dependsOn.length === 0) {
        eligible.push(job)
        continue
      }

      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential per job
      const failedDep = await getFailedDependency(job, this.adapter)
      if (failedDep) {
        const policy = job.onDependencyFailure ?? "fail"

        // oxlint-disable-next-line unicorn/prefer-ternary -- different status update shapes
        if (policy === "cancel") {
          // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- immediate transition
          await this.adapter.updateJobStatus(job.id, {
            cancellationReason: `Dependency job ${failedDep.id} (${failedDep.name}) failed`,
            status: "cancelled",
          })
        } else {
          // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- immediate transition
          await this.adapter.updateJobStatus(job.id, {
            error: {
              message: `Dependency job ${failedDep.id} (${failedDep.name}) failed`,
              name: "DependencyFailedError",
            },
            status: "failed",
          })
        }

        // Cascade further (only "fail" policy triggers recursive cascade)
        if (policy === "fail") {
          // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- cascade
          await cascadeDependencyFailure(job.id, this.adapter)
        }
        continue
      }

      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential check
      const met = await areDependenciesMet(job, this.adapter)
      if (!met) {
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- delay
        await this.adapter.updateJobStatus(job.id, {
          processAt: new Date(Date.now() + this.config.pollInterval),
          status: "delayed",
        })
        continue
      }

      eligible.push(job)
    }
    return eligible
  }

  private canRunHandler(name: string): boolean {
    const registered = this.handlers.get(name) ?? this.batchHandlers.get(name)
    if (!registered) {
      return false
    }

    // Check per-handler concurrency
    if (registered.options.concurrency) {
      let activeForHandler = 0
      for (const active of this.activeJobs.values()) {
        if (active.handlerName === name) {
          activeForHandler += 1
        }
      }
      if (activeForHandler >= registered.options.concurrency) {
        return false
      }
    }

    // Check rate limit
    if (this.rateLimiters.has(name) && !this.rateLimiters.canProcess(name)) {
      return false
    }

    return true
  }
}
