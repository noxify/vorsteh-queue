/**
 * Queue class (Producer).
 *
 * Responsible for adding jobs, cancellation, DLQ management, and stats.
 * Does NOT process jobs — that's the Worker's responsibility.
 *
 * @example
 * ```typescript
 * const queue = new Queue(adapter, { name: "my-queue" })
 * await queue.connect()
 *
 * await queue.add("send-email", { to: "user@example.com" })
 * await queue.add("cleanup", {}, { cron: "0 2 * * *" })
 *
 * const stats = await queue.getStats()
 * ```
 */

import { detectCircularDependencies } from "./dependencies"
import {
  DuplicateJobError,
  JobCancelledError,
  JobDeadError,
  JobFailedError,
  TimeoutError,
} from "./errors"
import { TypedEventEmitter } from "./events"
import type { Telemetry } from "./telemetry"
import { createTelemetry } from "./telemetry"
import type {
  ActiveStatus,
  FlowJobDefinition,
  FlowNode,
  FlowResult,
  Job,
  JobOptions,
  JobStatus,
  QueueAdapter,
  QueueConfig,
  QueueEvents,
  QueueStats,
} from "./types"
import { asUtc, parseCron, toUtcDate } from "./utils/scheduler"

export class Queue extends TypedEventEmitter<QueueEvents> {
  private readonly _adapter: QueueAdapter
  private readonly _config: Required<Pick<QueueConfig, "name">> & QueueConfig
  private readonly _telemetry: Telemetry

  /**
   * The queue name used for job isolation.
   */
  get name(): string {
    return this._config.name
  }

  /**
   * The underlying adapter instance.
   */
  get adapter(): QueueAdapter {
    return this._adapter
  }

  constructor(adapter: QueueAdapter, config: QueueConfig) {
    super()
    this._adapter = adapter
    this._config = {
      deadLetterQueue: { enabled: true },
      removeOnComplete: 100,
      removeOnFail: 50,
      ...config,
    }
    this._telemetry = createTelemetry({ queueName: this._config.name })

    this._adapter.setQueueName(this._config.name)
  }

  /**
   * Connect to the storage backend.
   */
  async connect(): Promise<void> {
    await this._adapter.connect()
  }

  /**
   * Disconnect from the storage backend.
   */
  async disconnect(): Promise<void> {
    await this._adapter.disconnect()
  }

  /**
   * Add a single job to the queue.
   *
   * @param name - Job type name (must match a registered handler on the Worker)
   * @param payload - Job data to process
   * @param options - Job configuration options
   * @returns The created job
   *
   * @example
   * ```typescript
   * // Basic job
   * await queue.add("send-email", { to: "user@example.com" })
   *
   * // High priority with delay
   * await queue.add("urgent-task", { data: "important" }, {
   *   priority: 1,
   *   delay: 5000,
   * })
   *
   * // Recurring cron job
   * await queue.add("cleanup", {}, { cron: "0 2 * * *" })
   *
   * // Unique job (reject duplicates)
   * await queue.add("sync-user", { userId: "123" }, {
   *   unique: { key: "sync:123", action: "reject" },
   * })
   * ```
   */
  async add<TPayload>(
    name: string,
    payload: TPayload,
    options: JobOptions = {}
  ): Promise<Job<TPayload>> {
    const jobOptions = { ...this._config.defaultJobOptions, ...options }
    const timezone = jobOptions.timezone ?? "UTC"
    const now = new Date()

    // Handle unique job logic
    if (jobOptions.unique) {
      const existing = await this._adapter.findJobByUniqueKey(
        jobOptions.unique.key
      )
      if (existing) {
        if (jobOptions.unique.action === "reject") {
          throw new DuplicateJobError(jobOptions.unique.key, existing.id)
        }
        // action === "replace": cancel existing, then add new
        await this._adapter.cancelJob(existing.id, "Replaced by newer job")
      }
    }

    // Detect circular dependencies before adding
    if (jobOptions.dependsOn && jobOptions.dependsOn.length > 0) {
      const tempId = crypto.randomUUID()
      await detectCircularDependencies(
        tempId,
        jobOptions.dependsOn,
        this._adapter
      )
    }

    // Determine initial status and processAt
    let processAt: Date
    let status: JobStatus = "pending"

    if (jobOptions.runAt) {
      processAt = toUtcDate(jobOptions.runAt, timezone)
      status = processAt > now ? "delayed" : "pending"
    } else if (jobOptions.delay) {
      processAt = asUtc(new Date(now.getTime() + jobOptions.delay))
      status = "delayed"
    } else if (jobOptions.cron) {
      processAt = parseCron(jobOptions.cron, timezone, now)
      status = "delayed"
    } else {
      processAt = asUtc(now)
    }

    const job = await this._adapter.addJob({
      attempts: 0,
      cron: jobOptions.cron,
      dependsOn: jobOptions.dependsOn,
      groupKey: jobOptions.group,
      maxAttempts: jobOptions.maxAttempts ?? 3,
      name,
      payload,
      priority: jobOptions.priority ?? 2,
      processAt,
      progress: 0,
      repeatCount: 0,
      repeatEvery: jobOptions.repeat?.every,
      repeatLimit: jobOptions.repeat?.limit,
      status,
      timeout: jobOptions.timeout,
      uniqueKey: jobOptions.unique?.key,
    })

    this.emit("job:added", job)
    this._telemetry.jobAdded(name)
    return job as Job<TPayload>
  }

  /**
   * Add multiple jobs in a batch.
   *
   * @param name - Job type name
   * @param payloads - Array of job payloads
   * @param options - Job configuration options (applied to all jobs)
   * @returns Array of created jobs
   */
  async addJobs<TPayload>(
    name: string,
    payloads: readonly TPayload[],
    options: JobOptions = {}
  ): Promise<readonly Job<TPayload>[]> {
    const jobOptions = { ...this._config.defaultJobOptions, ...options }
    const now = new Date()

    const newJobs = payloads.map((payload) => ({
      attempts: 0,
      groupKey: jobOptions.group,
      maxAttempts: jobOptions.maxAttempts ?? 3,
      name,
      payload,
      priority: jobOptions.priority ?? 2,
      processAt: asUtc(now),
      progress: 0,
      repeatCount: 0,
      status: "pending" as JobStatus,
      timeout: jobOptions.timeout,
    }))

    const jobs = await this._adapter.addJobs(newJobs)
    for (const job of jobs) {
      this.emit("job:added", job)
      this._telemetry.jobAdded(name)
    }
    return jobs as readonly Job<TPayload>[]
  }

  /**
   * Enqueue a job and wait for its result.
   *
   * Uses a hybrid approach: listens for events (fast, in-process) and
   * polls the database (works cross-process) as fallback.
   *
   * @param name - Job type name
   * @param payload - Job data
   * @param options - Job options plus waitTimeout and pollInterval
   * @returns The job result
   * @throws {TimeoutError} If the job does not complete within waitTimeout
   * @throws {JobFailedError} If the job fails
   * @throws {JobCancelledError} If the job is cancelled
   * @throws {JobDeadError} If the job moves to DLQ
   *
   * @example
   * ```typescript
   * const result = await queue.enqueueAndWait("process-image", {
   *   url: "https://example.com/img.png",
   * }, { waitTimeout: 60000 })
   * ```
   */
  async enqueueAndWait<TPayload, TResult>(
    name: string,
    payload: TPayload,
    options?: JobOptions & { waitTimeout?: number; pollInterval?: number }
  ): Promise<TResult> {
    const job = await this.add(name, payload, options)
    const timeout = options?.waitTimeout ?? 30_000
    const pollInterval = options?.pollInterval ?? 200

    // eslint-disable-next-line promise/avoid-new
    return new Promise<TResult>((resolve, reject) => {
      const startTime = Date.now()
      let resolved = false
      let timer: ReturnType<typeof setTimeout> | undefined

      const cleanup = (): void => {
        if (timer) {
          clearTimeout(timer)
        }
        this.off("job:completed", onCompleted)
        this.off("job:failed", onFailed)
        this.off("job:cancelled", onCancelled)
        this.off("job:dead", onDead)
      }

      const onCompleted = (completedJob: Job): void => {
        if (completedJob.id === job.id && !resolved) {
          resolved = true
          cleanup()
          resolve(completedJob.result as TResult)
        }
      }

      const onFailed = (failedJob: Job): void => {
        if (failedJob.id === job.id && !resolved) {
          resolved = true
          cleanup()
          reject(new JobFailedError(failedJob))
        }
      }

      const onCancelled = (
        cancelledJob: Job & { cancellationReason?: string }
      ): void => {
        if (cancelledJob.id === job.id && !resolved) {
          resolved = true
          cleanup()
          reject(new JobCancelledError(cancelledJob))
        }
      }

      const onDead = (deadJob: Job): void => {
        if (deadJob.id === job.id && !resolved) {
          resolved = true
          cleanup()
          reject(new JobDeadError(deadJob))
        }
      }

      // Event-based (in-process Worker)
      this.on("job:completed", onCompleted)
      this.on("job:failed", onFailed)
      this.on("job:cancelled", onCancelled)
      this.on("job:dead", onDead)

      // DB polling fallback
      const poll = async (): Promise<void> => {
        if (resolved) {
          return
        }
        if (Date.now() - startTime > timeout) {
          resolved = true
          cleanup()
          reject(
            new TimeoutError(
              `Job ${job.id} did not complete within ${timeout}ms`
            )
          )
          return
        }

        const current = await this._adapter.getJobById(job.id)
        if (!current) {
          timer = setTimeout(() => void poll(), pollInterval)
          return
        }

        if (current.status === "completed") {
          resolved = true
          cleanup()
          resolve(current.result as TResult)
        } else if (current.status === "dead") {
          resolved = true
          cleanup()
          reject(new JobDeadError(current))
        } else if (current.status === "failed") {
          resolved = true
          cleanup()
          reject(new JobFailedError(current))
        } else if (current.status === "cancelled") {
          resolved = true
          cleanup()
          reject(new JobCancelledError(current))
        } else {
          timer = setTimeout(() => void poll(), pollInterval)
        }
      }

      timer = setTimeout(() => void poll(), pollInterval)
    })
  }

  /**
   * Cancel a single job by ID.
   *
   * @param jobId - ID of the job to cancel
   * @param reason - Optional cancellation reason
   *
   * @example
   * ```typescript
   * await queue.cancel(jobId, "No longer needed")
   * ```
   */
  async cancel(jobId: string, reason?: string): Promise<void> {
    const cancelled = await this._adapter.cancelJob(jobId, reason)
    if (cancelled) {
      const job = await this._adapter.getJobById(jobId)
      if (job) {
        this.emit("job:cancelled", { ...job, cancellationReason: reason })
      }
    }
  }

  /**
   * Cancel multiple jobs matching a filter.
   *
   * @param filter - Optional filter criteria
   * @returns Number of jobs cancelled
   *
   * @example
   * ```typescript
   * // Cancel all pending jobs for a handler
   * const count = await queue.cancelAll({ name: "send-email", status: "pending" })
   * ```
   */
  async cancelAll(filter?: {
    name?: string
    status?: ActiveStatus
    group?: string
  }): Promise<number> {
    return this._adapter.cancelJobs(filter ?? {})
  }

  /**
   * Get a job by its ID.
   *
   * @param jobId - Job ID to look up
   * @returns The job or null if not found
   */
  async getJob(jobId: string): Promise<Job | null> {
    return this._adapter.getJobById(jobId)
  }

  /**
   * Get queue statistics (job counts by status).
   *
   * @returns Queue stats object
   *
   * @example
   * ```typescript
   * const stats = await queue.getStats()
   * console.log(`Pending: ${stats.pending}, Dead: ${stats.dead}`)
   * ```
   */
  async getStats(): Promise<QueueStats> {
    return this._adapter.getQueueStats()
  }

  /**
   * Get dead-letter jobs with pagination.
   *
   * @param options - Pagination options (limit, offset)
   * @returns Array of dead jobs
   */
  async getDeadJobs(options?: {
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    return this._adapter.getDeadJobs(options)
  }

  /**
   * Redrive a single dead job back to pending.
   *
   * @param jobId - ID of the dead job to redrive
   */
  async redrive(jobId: string): Promise<void> {
    await this._adapter.redriveJob(jobId)
  }

  /**
   * Redrive all dead jobs (optionally filtered by handler name).
   *
   * @param filter - Optional filter by job name
   * @returns Number of jobs redriven
   */
  async redriveAll(filter?: { name?: string }): Promise<number> {
    return this._adapter.redriveJobs(filter)
  }

  /**
   * Clear jobs from the queue.
   *
   * @param status - Optional status filter; clears all if omitted
   * @returns Number of jobs cleared
   *
   * @example
   * ```typescript
   * await queue.clear("completed") // clear only completed
   * await queue.clear() // clear everything
   * ```
   */
  async clear(status?: JobStatus): Promise<number> {
    return this._adapter.clearJobs(status)
  }

  /**
   * Send a signal to a waiting job (for step.waitFor flows).
   *
   * @param jobId - ID of the job waiting for the signal
   * @param event - Event name the job is waiting for
   * @param data - Signal data to pass to the job
   * @returns true if the signal was delivered
   *
   * @example
   * ```typescript
   * await queue.signal(jobId, "manager-approved", { approved: true })
   * ```
   */
  async signal(jobId: string, event: string, data?: unknown): Promise<boolean> {
    return this._adapter.setJobSignal(jobId, event, data)
  }

  /**
   * Retry a failed job (reset to pending with zero attempts).
   *
   * @param jobId - ID of the failed job
   * @returns true if the job was retried
   *
   * @example
   * ```typescript
   * await queue.retry(jobId)
   * ```
   */
  async retry(jobId: string): Promise<boolean> {
    return this._adapter.retryJob(jobId)
  }

  /**
   * Promote a delayed job to run immediately.
   *
   * @param jobId - ID of the delayed job
   * @returns true if the job was promoted
   *
   * @example
   * ```typescript
   * await queue.runNow(jobId)
   * ```
   */
  async runNow(jobId: string): Promise<boolean> {
    return this._adapter.runJobNow(jobId)
  }

  /**
   * Delete a single job by ID.
   *
   * @param jobId - ID of the job to delete
   * @returns true if the job was deleted
   *
   * @example
   * ```typescript
   * await queue.deleteJob(jobId)
   * ```
   */
  async deleteJob(jobId: string): Promise<boolean> {
    return this._adapter.deleteJob(jobId)
  }

  // ─── Flows ─────────────────────────────────────────────────

  /**
   * Create a flow (parent-child job tree). Children are processed first;
   * the parent moves to `pending` only when all children complete.
   *
   * @param definition - Declarative tree of jobs
   * @returns Flow result with ID and root job
   *
   * @example
   * ```typescript
   * const flow = await queue.addFlow({
   *   name: "deploy",
   *   payload: { version: "1.0" },
   *   children: [
   *     { name: "build", payload: { target: "linux" } },
   *     { name: "build", payload: { target: "macos" } },
   *     { name: "test", payload: {}, children: [
   *       { name: "lint", payload: {} },
   *     ]},
   *   ],
   * })
   * ```
   */
  async addFlow(definition: FlowJobDefinition): Promise<FlowResult> {
    const flowId = crypto.randomUUID()
    const rootJob = await this.createFlowNode(definition, flowId)
    return { id: flowId, job: rootJob }
  }

  /**
   * Get the full flow tree for visualization.
   *
   * @param flowId - Flow ID
   * @returns Tree structure with jobs and children, or null
   */
  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    return this._adapter.getFlowTree(flowId)
  }

  private async createFlowNode(
    definition: FlowJobDefinition,
    flowId: string,
    parentId?: string
  ): Promise<Job> {
    const hasChildren = definition.children && definition.children.length > 0

    // Create the job
    const job = await this._adapter.addJob({
      name: definition.name,
      payload: definition.payload,
      status: hasChildren ? "waiting-children" : "pending",
      priority: definition.options?.priority ?? 2,
      attempts: 0,
      maxAttempts: definition.options?.maxAttempts ?? 3,
      processAt: new Date(),
      progress: 0,
      repeatCount: 0,
      timeout: definition.options?.timeout,
      groupKey: definition.options?.group,
      parentId,
      flowId,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      childrenCount: hasChildren ? definition.children!.length : 0,
      childrenCompleted: 0,
      failParentOnFailure: definition.failParentOnFailure,
    })

    // Create children recursively
    if (hasChildren) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      for (const childDef of definition.children!) {
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- recursive tree creation must be sequential
        await this.createFlowNode(childDef, flowId, job.id)
      }
    }

    return job
  }
}
