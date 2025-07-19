import type { Simplify } from "type-fest"

import type {
  BaseJob,
  JobHandler,
  JobOptions,
  JobStatus,
  QueueAdapter,
  QueueConfig,
  QueueEvents,
  QueueStats,
} from "../../types"
import { calculateDelay, waitFor } from "../utils/helpers"
import { calculateNextRun, nowUtc, parseCron, toUtcDate } from "../utils/scheduler"
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
      processingInterval: 100,
      jobInterval: 10,
      ...config,
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
   * @param name - The job type name
   * @param handler - Function to process jobs of this type
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
   * Add a new job to the queue.
   *
   * @param name - The job type name (must be registered)
   * @param payload - Job data to process
   * @param options - Job configuration options
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
    const now = nowUtc()

    let processAt: Date
    let status: JobStatus = "pending"

    if (jobOptions.runAt) {
      // Convert user-provided time to UTC using timezone context
      processAt = toUtcDate(jobOptions.runAt, timezone)
      status = processAt > now ? "delayed" : "pending"
    } else if (jobOptions.delay) {
      processAt = new Date(now.getTime() + jobOptions.delay)
      status = "delayed"
    } else if (jobOptions.cron) {
      // Parse cron in timezone, get UTC result
      processAt = parseCron(jobOptions.cron, timezone, now)
      status = "delayed"
    } else {
      processAt = now
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
    })

    this.emit("job:added", job)
    return job
  }

  async enqueue<TJobPayload>(
    name: string,
    payload: TJobPayload,
    options: JobOptions = {},
  ): Promise<BaseJob<TJobPayload>> {
    return this.add(name, payload, options)
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
   * @returns Promise resolving to queue statistics
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

  async clear(status?: Parameters<QueueAdapter["clearJobs"]>[0]): Promise<number> {
    return this.adapter.clearJobs(status)
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    await this.adapter.updateJobProgress(id, progress)
  }

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
   * @param event - Event name to listen for
   * @param listener - Event handler function
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

  private emit<TEventName extends keyof QueueEvents>(
    event: TEventName,
    data: QueueEvents[TEventName],
  ): void {
    const eventListeners = this.listeners.get(event) ?? []
    for (const listener of eventListeners) {
      void listener(data)
    }
  }

  private async poll(): Promise<void> {
    const { concurrency, processingInterval, jobInterval } = this.config

    while (!this.stopped) {
      if (this.isPaused || this.activeJobs >= concurrency) {
        await waitFor(processingInterval)
        continue
      }

      let queueSize = await this.adapter.size()
      if (queueSize === 0) {
        await waitFor(processingInterval)
        continue
      }

      while (queueSize > 0) {
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
  }

  private async dequeueAndProcess(): Promise<boolean> {
    const job = await this.adapter.getNextJob()
    if (!job) return false

    await this.processJob(job)
    return true
  }

  private async processJob(job: BaseJob): Promise<void> {
    const handler = this.handlers.get(job.name)
    if (!handler) {
      await this.failJob(job, `No handler registered for job: ${job.name}`)
      return
    }

    await this.adapter.updateJobStatus(job.id, "processing")
    this.emit("job:processing", { ...job, status: "processing" })

    try {
      const timeout = this.config.defaultJobOptions.timeout ?? 30000
      await Promise.race([
        handler(createJobWrapper(job, this)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Job timeout")), timeout)),
      ])

      await this.adapter.updateJobStatus(job.id, "completed")
      this.emit("job:completed", { ...job, status: "completed", completedAt: new Date() })

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

  private async handleJobError(job: BaseJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (job.attempts + 1 < job.maxAttempts) {
      await this.retryJob(job, errorMessage)
    } else {
      await this.failJob(job, errorMessage)
    }
  }

  private async retryJob(job: BaseJob, _error: string): Promise<void> {
    await this.adapter.incrementJobAttempts(job.id)

    const delay = Math.min(calculateDelay(job.attempts), this.config.maxRetryDelay)

    const processAt = new Date(Date.now() + delay)
    await this.adapter.updateJobStatus(job.id, "pending")

    this.emit("job:retried", { ...job, attempts: job.attempts + 1, processAt })
  }

  private async failJob(job: BaseJob, error: string): Promise<void> {
    await this.adapter.updateJobStatus(job.id, "failed", error)
    this.emit("job:failed", {
      ...job,
      status: "failed",
      error,
      failedAt: new Date(),
    } as Simplify<BaseJob & { error: string }>)

    // Handle job cleanup
    await this.cleanupFailedJob()
  }

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
