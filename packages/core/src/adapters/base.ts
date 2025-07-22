import type { BaseJob, JobStatus, QueueAdapter, QueueStats } from "../../types"

/**
 * Base class for queue adapters providing common functionality.
 * Extend this class to create custom queue adapters for different databases.
 */
export abstract class BaseQueueAdapter implements QueueAdapter {
  protected queueName = ""

  /**
   * Set the queue name. Called by the Queue class during initialization.
   *
   * @internal
   */
  setQueueName(queueName: string): void {
    this.queueName = queueName
  }

  /** Connect to the database/storage backend */
  abstract connect(): Promise<void>

  /** Disconnect from the database/storage backend */
  abstract disconnect(): Promise<void>

  /**
   * Add a new job to the queue storage
   *
   * @param job - Job data without id and createdAt
   * @returns Promise resolving to the created job with id and createdAt
   */
  abstract addJob<TJobPayload, TJobResult = unknown>(
    job: Omit<BaseJob<TJobPayload, TJobResult>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload, TJobResult>>

  /**
   * Update job status and optionally set error or result
   *
   * @param id - Job ID to update
   * @param status - New job status
   * @param error - Optional error data for failed jobs
   * @param result - Optional result data for completed jobs
   */
  abstract updateJobStatus(
    id: string,
    status: JobStatus,
    error?: unknown,
    result?: unknown,
  ): Promise<void>

  /**
   * Update job progress percentage
   *
   * @param id - Job ID to update
   * @param progress - Progress percentage (0-100)
   */
  abstract updateJobProgress(id: string, progress: number): Promise<void>

  /**
   * Increment job attempt counter
   *
   * @param id - Job ID to update
   */
  abstract incrementJobAttempts(id: string): Promise<void>

  /**
   * Get queue statistics by job status
   *
   * @returns Promise resolving to queue statistics
   */
  abstract getQueueStats(): Promise<QueueStats>

  /**
   * Clear jobs from the queue
   *
   * @param status - Optional status filter, clears all jobs if not provided
   * @returns Promise resolving to number of jobs cleared
   */
  abstract clearJobs(status?: JobStatus): Promise<number>

  /**
   * Clean up old jobs, keeping only the most recent N jobs
   *
   * @param status - Job status to clean up
   * @param keepCount - Number of jobs to keep
   * @returns Promise resolving to number of jobs cleaned up
   */
  abstract cleanupJobs(status: JobStatus, keepCount: number): Promise<number>

  /**
   * Get the number of pending jobs in the queue
   * @returns Promise resolving to number of pending jobs
   */
  abstract size(): Promise<number>

  /**
   * Execute a function within a database transaction
   *
   * @param fn - Function to execute in transaction
   * @returns Promise resolving to the function's return value
   */
  abstract transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult>

  /**
   * Get the next job to process, considering priority and delayed jobs.
   *
   * @returns Promise resolving to the next job or null if none available
   */
  async getNextJob(): Promise<BaseJob | null> {
    const now = new Date()

    // First try to get delayed jobs that are ready
    const delayedJob = await this.getDelayedJobReady(now)

    if (delayedJob) {
      await this.updateJobStatus(delayedJob.id, "pending")
      return { ...delayedJob, status: "pending" }
    }

    // Then get pending jobs by priority
    return this.getPendingJobByPriority()
  }

  /**
   * Get a delayed job that is ready to be processed
   *
   * @param now - Current timestamp to compare against processAt
   * @returns Promise resolving to ready delayed job or null
   * @protected
   */
  protected abstract getDelayedJobReady(now: Date): Promise<BaseJob | null>

  /**
   * Get the next pending job ordered by priority and creation time
   *
   * @returns Promise resolving to next pending job or null
   * @protected
   */
  protected abstract getPendingJobByPriority(): Promise<BaseJob | null>

  /**
   * Generate a unique job ID
   *
   * @returns Unique string identifier
   * @protected
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}
