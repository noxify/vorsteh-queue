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

import { TypedEventEmitter } from "./events"
import type { ChildNodeValue, FlowAdapter, FlowJobContext } from "./flow-types"
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
  SerializedError,
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
  private readonly flowAdapter?: FlowAdapter
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

    // Detect flow adapter support
    if ("createFlow" in adapter) {
      this.flowAdapter = adapter as unknown as FlowAdapter
    }

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

      const minSize = options.minSize ?? 1
      if (jobs.length >= minSize) {
        void this.processBatch(name, jobs, handler, options)
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

      void this.processJob(job, registered.handler)
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

      /* oxlint-disable react-doctor/async-parallel -- these must run sequentially (triggers before schedule) */
      // Promote flow node if this job belongs to a flow
      await this.handleFlowNodeCompletion(processingJob, result)

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

      // Handle flow node failure (fail-parent cascade)
      await this.handleFlowNodeFailure(deadJob, error)

      this.emit("job:dead", deadJob)
      this.emit("job:failed", { ...deadJob, error })
      this.telemetry.jobDead(job.name)

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

  // ─── Flow Node Promotion ─────────────────────────────────

  /**
   * After a job completes successfully, check if it belongs to a flow
   * and promote the parent node if all children are terminal.
   */
  private async handleFlowNodeCompletion(
    job: Job,
    result: unknown
  ): Promise<void> {
    if (!job.flowNodeId || !this.flowAdapter) {
      return
    }

    // Update this node to completed
    await this.flowAdapter.updateFlowNode(job.flowNodeId, {
      status: "completed",
      result,
      completedAt: new Date(),
    })

    // Get the node to find its parent
    const node = await this.flowAdapter.getFlowNode(job.flowNodeId)
    if (!node) {
      return
    }

    // Root node completed — flow is complete
    if (!node.parentNodeId) {
      this.emit("flow:completed", { flowId: node.flowId, result })
      const durationMs = Date.now() - node.createdAt.getTime()
      this.telemetry.flowCompleted(node.flowId, durationMs)
      return
    }

    // Increment parent's childrenCompleted
    const { completed, total } =
      await this.flowAdapter.incrementNodeChildrenCompleted(node.parentNodeId)

    // Check if parent is promotable (all children terminal)
    if (completed >= total) {
      await this.promoteFlowNode(node.parentNodeId)
    }
  }

  /**
   * Handle flow node failure when a job moves to "dead" status (terminal failure).
   * Marks the flow node as failed and applies the failure strategy (fail-parent cascade,
   * continue-parent promotion, or default increment-and-check).
   */
  private async handleFlowNodeFailure(
    job: Job,
    error: SerializedError
  ): Promise<void> {
    if (!job.flowNodeId || !this.flowAdapter) {
      return
    }

    // Update this node to failed
    await this.flowAdapter.updateFlowNode(job.flowNodeId, {
      status: "failed",
      error,
      completedAt: new Date(),
    })

    // Get the node to find its parent and failureStrategy
    const node = await this.flowAdapter.getFlowNode(job.flowNodeId)
    if (!node) {
      return
    }

    // Root node failed — flow failed
    if (!node.parentNodeId) {
      this.emit("flow:failed", { flowId: node.flowId, error })
      this.telemetry.flowFailed(node.flowId)
      return
    }

    if (node.failureStrategy === "fail-parent") {
      // Cascade failure to parent recursively
      await this.cascadeFlowFailure(node.parentNodeId, node.id, error)
    } else if (node.failureStrategy === "continue-parent") {
      // Promote parent immediately regardless of other children's state
      await this.flowAdapter.incrementNodeChildrenCompleted(node.parentNodeId)
      await this.promoteFlowNode(node.parentNodeId)
    } else {
      // Default: increment parent's completed count, check if all terminal
      const { completed, total } =
        await this.flowAdapter.incrementNodeChildrenCompleted(node.parentNodeId)
      if (completed >= total) {
        await this.promoteFlowNode(node.parentNodeId)
      }
    }
  }

  /**
   * Recursively fail parent nodes when a child with "fail-parent" strategy fails.
   * No job is created for failed parent nodes.
   */
  private async cascadeFlowFailure(
    parentNodeId: string,
    childNodeId: string,
    childError: SerializedError
  ): Promise<void> {
    if (!this.flowAdapter) {
      return
    }

    const parentNode = await this.flowAdapter.getFlowNode(parentNodeId)
    if (!parentNode || parentNode.status !== "waiting") {
      return
    }

    const cascadedError: SerializedError = {
      name: "FlowCascadeError",
      message: `Child node "${childNodeId}" failed with strategy "fail-parent": ${childError.message}`,
    }

    await this.flowAdapter.updateFlowNode(parentNodeId, {
      status: "failed",
      error: cascadedError,
      completedAt: new Date(),
    })

    // If this parent has no parent, it's the root — emit flow:failed
    if (!parentNode.parentNodeId) {
      this.emit("flow:failed", {
        flowId: parentNode.flowId,
        error: cascadedError,
      })
      this.telemetry.flowFailed(parentNode.flowId)
      return
    }

    // If this parent also has a parent, check if it should cascade further
    if (parentNode.failureStrategy === "fail-parent") {
      await this.cascadeFlowFailure(
        parentNode.parentNodeId,
        parentNodeId,
        cascadedError
      )
    } else {
      // Default: increment grandparent's completed count
      const { completed, total } =
        await this.flowAdapter.incrementNodeChildrenCompleted(
          parentNode.parentNodeId
        )
      if (completed >= total) {
        await this.promoteFlowNode(parentNode.parentNodeId)
      }
    }
  }

  /**
   * Promote a flow node: create a real job for the parent and update
   * the node status to "ready".
   */
  private async promoteFlowNode(nodeId: string): Promise<void> {
    if (!this.flowAdapter) {
      return
    }

    const parentNode = await this.flowAdapter.getFlowNode(nodeId)
    if (!parentNode || parentNode.status !== "waiting") {
      return
    }

    // Create a real job for the parent
    const job = await this.adapter.addJob({
      name: parentNode.name,
      payload: parentNode.payload,
      status: "pending",
      priority: parentNode.options?.priority ?? 2,
      attempts: 0,
      maxAttempts: parentNode.options?.maxAttempts ?? 3,
      processAt: new Date(),
      progress: 0,
      repeatCount: 0,
      timeout: parentNode.options?.timeout,
      flowNodeId: nodeId,
      groupKey: parentNode.options?.group,
    })

    // Update flow node to ready with job ID
    await this.flowAdapter.updateFlowNode(nodeId, {
      status: "ready",
      jobId: job.id,
    })

    this.emit("flow:node:promoted", {
      flowId: parentNode.flowId,
      nodeId,
      jobId: job.id,
    })
    this.telemetry.flowNodePromoted(parentNode.flowId, nodeId)
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

  private async cleanupAfterCompletion(_job: Job): Promise<void> {
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

    const flow: FlowJobContext | undefined =
      job.flowNodeId && this.flowAdapter
        ? this.createFlowContext(job.flowNodeId)
        : undefined

    return {
      ctx: {
        signal,
        step: stepContext,
        flow,
      },
      getSteps,
      runCompensations,
    }
  }

  /**
   * Create a FlowJobContext for a job that belongs to a flow.
   * Provides methods to query children values and cancel unprocessed children.
   */
  private createFlowContext(nodeId: string): FlowJobContext {
    return {
      getChildrenValues: async () => {
        if (!this.flowAdapter) {
          return new Map()
        }
        return this.flowAdapter.getChildrenResults(nodeId)
      },
      getFailedChildrenValues: async () => {
        if (!this.flowAdapter) {
          return new Map()
        }
        const results = await this.flowAdapter.getFailedChildrenResults(nodeId)
        return results as ReadonlyMap<string, SerializedError>
      },
      getChildrenValuesBy: async (filter) => {
        if (!this.flowAdapter) {
          return new Map()
        }
        const children = await this.flowAdapter.getNodeChildren(nodeId)
        const result = new Map<string, ChildNodeValue>()

        for (const child of children) {
          if (filter.name) {
            const names = Array.isArray(filter.name)
              ? filter.name
              : [filter.name]
            if (!names.includes(child.name)) {
              continue
            }
          }
          if (filter.status) {
            const statuses = Array.isArray(filter.status)
              ? filter.status
              : [filter.status]
            if (!statuses.includes(child.status)) {
              continue
            }
          }
          if (
            child.status !== "completed" &&
            child.status !== "failed" &&
            child.status !== "cancelled"
          ) {
            continue
          }
          result.set(child.id, {
            nodeId: child.id,
            name: child.name,
            status: child.status,
            result: child.result,
            error: child.error,
          })
        }

        return result
      },
      removeUnprocessedChildren: async () => {
        if (!this.flowAdapter) {
          return 0
        }
        return this.flowAdapter.cancelUnprocessedChildren(nodeId)
      },
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
