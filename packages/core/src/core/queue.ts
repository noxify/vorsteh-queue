import type { Simplify } from "type-fest"

import type {
  BaseJob,
  BatchJob,
  BatchJobHandler,
  JobHandler,
  JobOptions,
  JobStatus,
  QueueAdapter,
  QueueConfig,
  QueueEvents,
  QueueStats,
  SerializedError,
} from "../../types"
import { serializeError } from "../utils/error"
import { calculateDelay, waitFor } from "../utils/helpers"
import { asUtc, calculateNextRun, parseCron, toUtcDate } from "../utils/scheduler"
import { createJobWrapper } from "./job-wrapper"

type EventListener<TEventData> = (data: TEventData) => void | Promise<void>

/**
 * Main queue class for managing job processing.
 *
 * @example
 * ```typescript
 * const queue = new Queue(adapter, { name: "my-queue" })
 * queue.register("send-email", async (payload) => { ... })
 * await queue.add("send-email", { to: "user@example.com" })
 * queue.start()
 * ```
 */
export class Queue {
  private readonly adapter: QueueAdapter
  private readonly config: Required<QueueConfig>
  private readonly handlers = new Map<string, JobHandler>()
  private readonly batchHandlers = new Map<string, BatchJobHandler>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly listeners = new Map<keyof QueueEvents, EventListener<any>[]>()

  private isRunning = false
  private isPaused = false
  private activeJobs = 0
  private stopped = false

  constructor(adapter: QueueAdapter, config: QueueConfig) {
    this.adapter = adapter
    this.config = {
      concurrency: 1,
      defaultJobOptions: {
        priority: 2,
        maxAttempts: 3,
        timeout: 30000,
      },
      retryDelay: 1000,
      maxRetryDelay: 30000,
      removeOnComplete: 100,
      removeOnFail: 50,
      pollInterval: 100,
      jobInterval: 10,
      batch: { ...(config.batch ?? {}) },
      ...config,
    }

    // Set the queue name on the adapter
    if ("setQueueName" in adapter && typeof adapter.setQueueName === "function") {
      adapter.setQueueName(this.config.name)
    }
  }

  async connect(): Promise<void> {
    await this.adapter.connect()
  }

  async disconnect(): Promise<void> {
    await this.stop()
    await this.adapter.disconnect()
  }

  /**
   * Register a job handler for a specific job type.
   *
   * @param name The job type name
   * @param handler Function to process jobs of this type
   *
   * @example
   * ```typescript
   * queue.register("send-email", async (payload: { to: string }) => {
   *   // Send email logic
   *   return { sent: true }
   * })
   * ```
   */
  register<TJobPayload, TJobResult>(
    name: string,
    handler: JobHandler<TJobPayload, TJobResult>,
  ): void {
    this.handlers.set(name, handler as JobHandler)
  }

  /**
   * Register a batch job handler for a specific job type.
   *
   * @param name The job type name
   * @param handler Function to process jobs of this type in batches
   *
   * @example
   * ```typescript
   * queue.registerBatch("send-emails", async (jobs) => {
   *   // jobs: BatchJobWithProgress<Payload>[]
   *   // Batch processing logic
   * })
   * ```
   */
  registerBatch<TJobPayload, TJobResult>(
    name: string,
    handler: BatchJobHandler<TJobPayload, TJobResult>,
  ): void {
    this.batchHandlers.set(name, handler as BatchJobHandler)
  }

  /**
   * Add a new job to the queue.
   *
   * @param name The job type name (must be registered)
   * @param payload Job data to process
   * @param options Job configuration options
   * @returns Promise resolving to the created job
   *
   * @example
   * ```typescript
   * // Basic job
   * await queue.add("send-email", { to: "user@example.com" })
   *
   * // High priority job with delay
   * await queue.add("urgent-task", { data: "important" }, {
   *   priority: 1,
   *   delay: 5000
   * })
   *
   * // Recurring job
   * await queue.add("cleanup", {}, {
   *   cron: "0 2 * * *" // Daily at 2 AM
   * })
   * ```
   */
  async add<TJobPayload>(
    name: string,
    payload: TJobPayload,
    options: JobOptions = {},
  ): Promise<BaseJob<TJobPayload>> {
    const jobOptions = { ...this.config.defaultJobOptions, ...options }
    const timezone = jobOptions.timezone ?? "UTC"
    const now = new Date()

    let processAt: Date
    let status: JobStatus = "pending"

    if (jobOptions.runAt) {
      // Convert user-provided time to UTC using timezone context
      processAt = toUtcDate(jobOptions.runAt, timezone)
      status = processAt > now ? "delayed" : "pending"
    } else if (jobOptions.delay) {
      processAt = asUtc(new Date(now.getTime() + jobOptions.delay))
      status = "delayed"
    } else if (jobOptions.cron) {
      // Parse cron in timezone, get UTC result
      processAt = parseCron(jobOptions.cron, timezone, now)
      status = "delayed"
    } else {
      processAt = asUtc(now)
    }

    const job = await this.adapter.addJob({
      name,
      payload,
      status,
      priority: jobOptions.priority ?? 2,
      attempts: 0,
      maxAttempts: jobOptions.maxAttempts ?? 3,
      processAt,
      cron: jobOptions.cron,
      repeatEvery: jobOptions.repeat?.every,
      repeatLimit: jobOptions.repeat?.limit,
      repeatCount: 0,
      timeout: jobOptions.timeout,
    })

    this.emit("job:added", job)
    return job
  }

  /**
   * Alias for the `add()` method. Add a new job to the queue.
   *
   * @param name The job type name (must be registered)
   * @param payload Job data to process
   * @param options Job configuration options
   * @returns Promise resolving to the created job
   *
   * @example
   * ```typescript
   * // Basic job
   * await queue.enqueue("send-email", { to: "user@example.com" })
   *
   * // Priority job
   * await queue.enqueue("urgent-task", { data: "important" }, { priority: 1 })
   * ```
   */
  async enqueue<TJobPayload>(
    name: string,
    payload: TJobPayload,
    options: JobOptions = {},
  ): Promise<BaseJob<TJobPayload>> {
    return this.add(name, payload, options)
  }

  /**
   * Add multiple jobs to the queue in a single batch operation.
   *
   * @param name The job type name (must be registered)
   * @param payloads Array of job data to process
   * @param options Job configuration options (applied to all jobs)
   * @returns Promise resolving to the created jobs
   */
  async addJobs<TJobPayload>(
    name: string,
    payloads: TJobPayload[],
    options: JobOptions = {},
  ): Promise<BatchJob<TJobPayload>[]> {
    const jobOptions = { ...this.config.defaultJobOptions, ...options }

    const jobs = payloads.map((payload) => ({
      name,
      payload,
      status: "pending" as JobStatus,
      priority: jobOptions.priority ?? 2,
      attempts: 0,
      maxAttempts: jobOptions.maxAttempts ?? 3,
      timeout: jobOptions.timeout,
      processAt: new Date(),
    }))

    const createdJobs = await this.adapter.addJobs(jobs)
    createdJobs.forEach((job) => this.emit("job:added", job as BaseJob))
    return createdJobs
  }

  /**
   * Start processing jobs from the queue.
   * Jobs will be processed according to priority and concurrency settings.
   */
  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    this.isPaused = false
    this.stopped = false
    void this.poll()
  }

  /**
   * Stop the queue and wait for active jobs to complete.
   * Provides graceful shutdown functionality.
   */
  async stop(): Promise<void> {
    this.isRunning = false
    this.stopped = true

    while (this.activeJobs > 0) {
      await waitFor(100)
    }

    this.emit("queue:stopped", undefined)
  }

  /**
   * Pause job processing. Jobs can still be added but won't be processed.
   */
  pause(): void {
    this.isPaused = true
    this.emit("queue:paused", undefined)
  }

  /**
   * Resume job processing after being paused.
   */
  resume(): void {
    this.isPaused = false
    this.emit("queue:resumed", undefined)
  }

  /**
   * Get current queue statistics.
   *
   * @returns Promise<QueueStats> resolving to queue statistics
   *
   * @example
   * ```typescript
   * const stats = await queue.getStats()
   * console.log(`Pending: ${stats.pending}, Processing: ${stats.processing}`)
   * ```
   */
  async getStats(): Promise<QueueStats> {
    return this.adapter.getQueueStats()
  }

  /**
   * Get current queue configuration.
   *
   * @returns Queue configuration object
   *
   * @example
   * ```typescript
   * const config = queue.getConfig()
   * console.log(`Queue: ${config.name}, Concurrency: ${config.concurrency}`)
   * ```
   */
  getConfig(): Required<QueueConfig> {
    return { ...this.config }
  }

  /**
   * Returns the batch config for processing jobs in batches.
   */
  private getBatchConfig(): { minSize: number; maxSize: number; waitFor: number } {
    const batch = this.config.batch
    return {
      minSize: typeof batch.minSize === "number" && batch.minSize > 0 ? batch.minSize : 5,
      maxSize: typeof batch.maxSize === "number" && batch.maxSize > 0 ? batch.maxSize : 10,
      waitFor: typeof batch.waitFor === "number" && batch.waitFor > 0 ? batch.waitFor : 30000,
    }
  }

  /**
   * Clear jobs from the queue.
   *
   * @param status  Optional job status filter to clear only jobs with specific status
   * @returns Promise<number> resolving to number of jobs cleared
   *
   * @example
   * ```typescript
   * // Clear all jobs
   * const cleared = await queue.clear()
   *
   * // Clear only failed jobs
   * const clearedFailed = await queue.clear("failed")
   * ```
   */
  async clear(status?: Parameters<QueueAdapter["clearJobs"]>[0]): Promise<number> {
    return this.adapter.clearJobs(status)
  }

  /**
   * Update the progress of a specific job.
   *
   * @param id The job ID to update progress for
   * @param progress Progress percentage (0-100)
   * @returns Promise that resolves when progress is updated
   *
   * @example
   * ```typescript
   * // Update job progress to 50%
   * await queue.updateJobProgress(jobId, 50)
   *
   * // Update job progress to completion
   * await queue.updateJobProgress(jobId, 100)
   * ```
   */
  async updateJobProgress(id: string, progress: number): Promise<void> {
    await this.adapter.updateJobProgress(id, progress)
  }

  /**
   * Manually dequeue and mark the next job as completed without processing.
   * This is primarily used for testing or manual job management.
   *
   * @returns Promise<BaseJob | null> resolving to the dequeued job or null if no jobs available
   *
   * @example
   * ```typescript
   * // Manually dequeue next job
   * const job = await queue.dequeue()
   * if (job) {
   *   console.log(`Dequeued job: ${job.name}`)
   * }
   * ```
   */
  async dequeue(): Promise<BaseJob | null> {
    const job = await this.adapter.getNextJob()
    if (job) {
      await this.adapter.updateJobStatus(job.id, "completed")
    }
    return job
  }
  /**
   * Listen to queue events.
   *
   * @param event Event name to listen for
   * @param listener Event handler function
   *
   * @example
   * ```typescript
   * queue.on("job:completed", (job) => {
   *   console.log(`Job ${job.name} completed successfully`)
   * })
   *
   * queue.on("job:failed", (job) => {
   *   console.error(`Job ${job.name} failed: ${job.error}`)
   * })
   * ```
   */
  on<TEventName extends keyof QueueEvents>(
    event: TEventName,
    listener: EventListener<QueueEvents[TEventName]>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)?.push(listener)
  }

  /**
   * Internal method to emit queue events to registered listeners.
   *
   * @param event Event name to emit
   * @param data Event data to pass to listeners
   * @private
   *
   * @example
   * ```typescript
   * this.emit("job:completed", completedJobData)
   * this.emit("queue:error", errorData)
   * ```
   */
  private emit<TEventName extends keyof QueueEvents>(
    event: TEventName,
    data: QueueEvents[TEventName],
  ): void {
    const eventListeners = this.listeners.get(event) ?? []
    for (const listener of eventListeners) {
      void listener(data)
    }
  }

  /**
   * Internal polling method that continuously checks for and processes jobs.
   * Handles concurrency limits and processing intervals.
   *
   * @returns Promise that resolves when polling is stopped
   * @private
   */
  private async poll(): Promise<void> {
    const { concurrency, pollInterval, jobInterval } = this.config

    while (!this.stopped) {
      if (this.isPaused || this.activeJobs >= concurrency) {
        await waitFor(pollInterval)
        continue
      }

      let queueSize = await this.adapter.size()
      if (queueSize === 0) {
        await waitFor(pollInterval)
        continue
      }

      // Batch-Processing: Für jeden Batch-Handler werden bis zu maxSize Jobs gemeinsam verarbeitet
      const { minSize, maxSize } = this.getBatchConfig()
      const batchJobTypes = Array.from(this.batchHandlers.keys())

      // Versuche für jeden Batch-Handler einen Batch zu holen und zu verarbeiten
      for (const type of batchJobTypes) {
        if (this.activeJobs >= concurrency) break
        // Hole bis zu maxSize Jobs dieses Typs effizient per Adapter
        const jobs: BatchJob[] = (await this.adapter.getNextJobs(maxSize)).filter(
          (job) => job.name === type,
        )
        if (jobs.length >= minSize) {
          this.activeJobs++
          setImmediate(() => {
            void this.processBatchJobs(type, jobs)
              .catch((error) => this.emit("queue:error", error))
              .finally(() => {
                this.activeJobs--
              })
          })
        }
      }

      // Normales Einzel-Job-Processing für alle anderen Jobs
      while (queueSize > 0 && this.activeJobs < concurrency) {
        this.activeJobs++
        setImmediate(() => {
          void this.dequeueAndProcess()
            .then((processed) => {
              if (!processed) queueSize = 0
              else queueSize--
            })
            .catch((error) => {
              this.emit("queue:error", error)
            })
            .finally(() => {
              this.activeJobs--
            })
        })
        await waitFor(jobInterval)
      }
      await waitFor(jobInterval * 2)
    }
  }
  /**
   * Interne Methode: Verarbeitet einen Batch von Jobs mit dem registrierten Batch-Handler.
   */
  private async processBatchJobs(type: string, jobs: BatchJob[]): Promise<void> {
    const handler = this.batchHandlers.get(type)
    if (!handler) return

    // Status auf processing setzen und Wrapper erzeugen
    await Promise.all(jobs.map((job) => this.adapter.updateJobStatus(job.id, "processing")))
    jobs.forEach((job) => {
      this.emit("job:processing", { ...job, status: "processing" } as BaseJob)
    })

    // Batch-Event: processing
    this.emit("batch:processing", jobs as BaseJob[])

    // Job-Wrapper mit updateProgress
    const wrappedJobs = jobs.map((job) => createJobWrapper(job as BaseJob, this))

    try {
      const result = await handler(wrappedJobs)
      // Ergebnisse auf Jobs mappen (optional)
      await Promise.all(
        jobs.map((job, i) =>
          this.adapter.updateJobStatus(job.id, "completed", undefined, result?.[i]),
        ),
      )
      jobs.forEach((job, i) => {
        this.emit("job:completed", {
          ...job,
          status: "completed",
          completedAt: new Date(),
          result: result?.[i],
        } as BaseJob)
      })
      // Batch-Event: completed
      this.emit(
        "batch:completed",
        jobs.map(
          (job, i) =>
            ({
              ...job,
              status: "completed",
              completedAt: new Date(),
              result: result?.[i],
            }) as BaseJob,
        ),
      )
      await this.cleanupCompletedJob()
    } catch (error) {
      // Fehlerbehandlung für alle Jobs im Batch
      const serializedError = serializeError(error)
      await Promise.all((jobs as BaseJob[]).map((job) => this.handleJobError(job, error)))
      // Batch-Event: failed
      this.emit("batch:failed", { jobs: jobs as BaseJob[], error: serializedError })
    }
  }

  /**
   * Internal method to dequeue and process a single job.
   *
   * @returns Promise resolving to boolean indicating if job was processed
   * @private
   */
  private async dequeueAndProcess(): Promise<boolean> {
    const job = await this.adapter.getNextJob()
    if (!job) return false

    await this.processJob(job)
    return true
  }

  /**
   * Internal method to process a job using its registered handler.
   * Handles job timeouts, completion, cleanup and recurring job scheduling.
   *
   * @param job The job to process
   * @returns Promise that resolves when job processing is complete
   * @private
   */
  private async processJob(job: BaseJob): Promise<void> {
    const handler = this.handlers.get(job.name)
    if (!handler) {
      await this.failJob(
        job,
        serializeError(new Error(`No handler registered for job: ${job.name}`)),
      )
      return
    }

    await this.adapter.updateJobStatus(job.id, "processing")
    this.emit("job:processing", { ...job, status: "processing" })

    try {
      const timeout = job.timeout ?? this.config.defaultJobOptions.timeout ?? 30000

      const result =
        timeout === false
          ? await handler(createJobWrapper(job, this))
          : await Promise.race([
              handler(createJobWrapper(job, this)),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Job timeout")), timeout),
              ),
            ])

      await this.adapter.updateJobStatus(job.id, "completed", undefined, result)
      this.emit("job:completed", { ...job, status: "completed", completedAt: new Date(), result })

      // Handle job cleanup
      await this.cleanupCompletedJob()

      // Handle recurring jobs
      this.handleRecurringJob(job).catch(() => {
        // Ignore errors in recurring job creation
      })
    } catch (error) {
      await this.handleJobError(job, error)
    }
  }

  /**
   * Internal method to handle job errors.
   * Determines whether to retry or fail the job based on attempt count.
   *
   * @param job The failed job
   * @param error The error that occurred
   * @returns Promise that resolves when error handling is complete
   * @private
   */
  private async handleJobError(job: BaseJob, error: unknown): Promise<void> {
    const serializedError = serializeError(error)

    if (job.attempts + 1 < job.maxAttempts) {
      await this.retryJob(job, serializedError)
    } else {
      await this.failJob(job, serializedError)
    }
  }

  /**
   * Internal method to retry a failed job.
   * Increments attempt count and schedules next attempt with backoff delay.
   *
   * @param job The job to retry
   * @param _error The error from the failed attempt
   * @returns Promise that resolves when job is scheduled for retry
   * @private
   */
  private async retryJob(job: BaseJob, _error: unknown): Promise<void> {
    await this.adapter.incrementJobAttempts(job.id)

    const delay = Math.min(calculateDelay(job.attempts), this.config.maxRetryDelay)

    const processAt = new Date(Date.now() + delay)
    await this.adapter.updateJobStatus(job.id, "pending")

    this.emit("job:retried", { ...job, attempts: job.attempts + 1, processAt })
  }

  /**
   * Internal method to mark a job as permanently failed.
   * Updates job status and triggers cleanup of failed jobs.
   *
   * @param job The job to fail
   * @param error The error that caused the failure
   * @returns Promise that resolves when job is marked as failed
   * @private
   */
  private async failJob(job: BaseJob, error: unknown): Promise<void> {
    await this.adapter.updateJobStatus(job.id, "failed", error)
    this.emit("job:failed", {
      ...job,
      status: "failed",
      error,
      failedAt: new Date(),
    } as Simplify<BaseJob & { error: SerializedError }>)

    // Handle job cleanup
    await this.cleanupFailedJob()
  }

  /**
   * Internal method to clean up completed jobs based on queue configuration.
   * Can remove jobs immediately, keep all jobs, or maintain a fixed number of completed jobs.
   *
   * @returns Promise that resolves when cleanup is complete
   * @private
   */
  private async cleanupCompletedJob(): Promise<void> {
    const { removeOnComplete } = this.config

    if (removeOnComplete === true) {
      // Remove immediately
      await this.adapter.clearJobs("completed")
    } else if (removeOnComplete === false) {
      // Keep all completed jobs - no cleanup
      return
    } else if (typeof removeOnComplete === "number" && removeOnComplete > 0) {
      // Keep only N completed jobs
      await this.adapter.cleanupJobs("completed", removeOnComplete)
    }
  }

  /**
   * Internal method to clean up failed jobs based on queue configuration.
   * Can remove jobs immediately, keep all jobs, or maintain a fixed number of failed jobs.
   *
   * @returns Promise that resolves when cleanup is complete
   * @private
   */
  private async cleanupFailedJob(): Promise<void> {
    const { removeOnFail } = this.config

    if (removeOnFail === true) {
      // Remove immediately
      await this.adapter.clearJobs("failed")
    } else if (removeOnFail === false) {
      // Keep all failed jobs - no cleanup
      return
    } else if (typeof removeOnFail === "number" && removeOnFail > 0) {
      // Keep only N failed jobs
      await this.adapter.cleanupJobs("failed", removeOnFail)
    }
  }

  /**
   * Internal method to handle recurring job scheduling.
   * Creates the next occurrence of recurring jobs based on cron or repeat interval.
   *
   * @param job The completed job that may need to be rescheduled
   * @param originalTimezone Optional timezone for cron scheduling
   * @returns Promise that resolves when next job is scheduled
   * @private
   */
  private async handleRecurringJob(job: BaseJob, originalTimezone?: string): Promise<void> {
    if (!job.cron && !job.repeatEvery) return

    const nextCount = (job.repeatCount ?? 0) + 1

    // Check repeat limit before creating next job
    if (job.repeatLimit && nextCount >= job.repeatLimit) return

    try {
      const nextRun = calculateNextRun({
        cron: job.cron,
        repeatEvery: job.repeatEvery,
        timezone: originalTimezone ?? "UTC",
        lastRun: new Date(),
      })

      // Create next occurrence
      await this.adapter.addJob({
        name: job.name,
        payload: job.payload,
        status: "delayed",
        priority: job.priority,
        attempts: 0,
        maxAttempts: job.maxAttempts,
        processAt: nextRun,
        cron: job.cron,
        repeatEvery: job.repeatEvery,
        repeatLimit: job.repeatLimit,
        repeatCount: nextCount,
      })
    } catch {
      // Log error but don't fail the original job
    }
  }
}
