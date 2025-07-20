import type { BaseJob, JobStatus, QueueAdapter, QueueStats } from "../../types"

/**
 * Base class for queue adapters providing common functionality.
 * Extend this class to create custom queue adapters for different databases.
 */
export abstract class BaseQueueAdapter implements QueueAdapter {
  protected queueName = ""

  /**
   * Set the queue name. Called by the Queue class during initialization.
   * @internal
   */
  setQueueName(queueName: string): void {
    this.queueName = queueName
  }

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract addJob<TJobPayload>(
    job: Omit<BaseJob<TJobPayload>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload>>
  abstract updateJobStatus(id: string, status: JobStatus, error?: unknown): Promise<void>
  abstract updateJobProgress(id: string, progress: number): Promise<void>
  abstract incrementJobAttempts(id: string): Promise<void>
  abstract getQueueStats(): Promise<QueueStats>
  abstract clearJobs(status?: JobStatus): Promise<number>
  abstract cleanupJobs(status: JobStatus, keepCount: number): Promise<number>
  abstract size(): Promise<number>
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

  protected abstract getDelayedJobReady(now: Date): Promise<BaseJob | null>
  protected abstract getPendingJobByPriority(): Promise<BaseJob | null>

  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}
