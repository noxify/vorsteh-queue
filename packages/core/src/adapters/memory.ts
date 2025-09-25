import type { BaseJob, BatchJob, JobStatus, QueueStats } from "../../types"
import { serializeError } from "../utils/error"
import { BaseQueueAdapter } from "./base"

/**
 * In-memory queue adapter for testing and development.
 * Stores all job data in memory - data is lost when the process exits.
 *
 * @example
 * ```typescript
 * const adapter = new MemoryQueueAdapter()
 * const queue = new Queue(adapter, { name: "test-queue" })
 * ```
 */
export class MemoryQueueAdapter extends BaseQueueAdapter {
  private jobs = new Map<string, BaseJob>()
  private connected = false

  connect(): Promise<void> {
    this.connected = true
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    this.connected = false
    this.jobs.clear()
    return Promise.resolve()
  }

  addJob<TJobPayload, TJobResult = unknown>(
    job: Omit<BaseJob<TJobPayload, TJobResult>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload, TJobResult>> {
    const id = this.generateId()
    const createdAt = new Date()

    const newJob: BaseJob<TJobPayload, TJobResult> = {
      ...job,
      id,
      createdAt,
      cron: job.cron,
      repeatEvery: job.repeatEvery,
      repeatLimit: job.repeatLimit,
      repeatCount: job.repeatCount ?? 0,
      timeout: job.timeout,
    }

    this.jobs.set(id, newJob)
    return Promise.resolve(newJob)
  }

  addJobs<TJobPayload, TJobResult = unknown>(
    jobs: Omit<BatchJob<TJobPayload, TJobResult>, "id" | "createdAt">[],
  ): Promise<BatchJob<TJobPayload, TJobResult>[]> {
    const created: BatchJob<TJobPayload, TJobResult>[] = jobs.map((job) => {
      const id = this.generateId()
      const createdAt = new Date()
      const newJob: BatchJob<TJobPayload, TJobResult> = {
        ...job,
        id,
        createdAt,
      }
      this.jobs.set(id, newJob as BaseJob)
      return newJob
    })
    return Promise.resolve(created)
  }

  updateJobStatus(id: string, status: JobStatus, error?: unknown, result?: unknown): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) return Promise.resolve()

    const now = new Date()
    const updatedJob: BaseJob = {
      ...job,
      status,
      error: error ? serializeError(error) : undefined,
      result: result !== undefined ? result : job.result,
      processedAt: status === "processing" ? now : job.processedAt,
      completedAt: status === "completed" ? now : job.completedAt,
      failedAt: status === "failed" ? now : job.failedAt,
    }

    this.jobs.set(id, updatedJob)
    return Promise.resolve()
  }

  incrementJobAttempts(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) return Promise.resolve()

    this.jobs.set(id, { ...job, attempts: job.attempts + 1 })
    return Promise.resolve()
  }

  updateJobProgress(id: string, progress: number): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) return Promise.resolve()

    const normalizedProgress = Math.max(0, Math.min(100, progress))
    this.jobs.set(id, { ...job, progress: normalizedProgress })
    return Promise.resolve()
  }

  getQueueStats(): Promise<QueueStats> {
    const stats = { pending: 0, processing: 0, completed: 0, failed: 0, delayed: 0 }

    for (const job of this.jobs.values()) {
      stats[job.status]++
    }

    return Promise.resolve(stats)
  }

  clearJobs(status?: JobStatus): Promise<number> {
    if (!status) {
      const count = this.jobs.size
      this.jobs.clear()
      return Promise.resolve(count)
    }

    let count = 0
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === status) {
        this.jobs.delete(id)
        count++
      }
    }

    return Promise.resolve(count)
  }

  cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    const jobsWithStatus = Array.from(this.jobs.values())
      .filter((job) => job.status === status)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) // Most recent first

    const jobsToDelete = jobsWithStatus.slice(keepCount)

    for (const job of jobsToDelete) {
      this.jobs.delete(job.id)
    }

    return Promise.resolve(jobsToDelete.length)
  }

  size(): Promise<number> {
    const count = Array.from(this.jobs.values()).filter(
      (job) => job.status === "pending" || job.status === "delayed",
    ).length
    return Promise.resolve(count)
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    // Memory adapter doesn't need real transactions
    return fn()
  }

  protected getDelayedJobReady(now: Date): Promise<BaseJob | null> {
    for (const job of this.jobs.values()) {
      if (job.status === "delayed" && job.processAt <= now) {
        return Promise.resolve(job)
      }
    }
    return Promise.resolve(null)
  }

  protected getPendingJobByPriority(): Promise<BaseJob | null> {
    const pendingJobs = Array.from(this.jobs.values())
      .filter((job) => job.status === "pending")
      .sort((a, b) => {
        const priorityDiff = a.priority - b.priority
        return priorityDiff !== 0 ? priorityDiff : a.createdAt.getTime() - b.createdAt.getTime()
      })

    return Promise.resolve(pendingJobs[0] ?? null)
  }

  getNextJobsForHandler(handlerName: string, count: number): Promise<BatchJob[]> {
    const pendingJobs = Array.from(this.jobs.values())
      .filter((job) => job.status === "pending" && job.name === handlerName)
      .sort((a, b) => {
        const priorityDiff = a.priority - b.priority
        return priorityDiff !== 0 ? priorityDiff : a.createdAt.getTime() - b.createdAt.getTime()
      })
      .slice(0, count)
      .map((job) => job as BatchJob)

    return Promise.resolve(pendingJobs)
  }
}
