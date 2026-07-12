/**
 * In-memory queue adapter for testing and development.
 *
 * Stores all job data in memory — data is lost when the process exits.
 * Implements the full QueueAdapter interface including group FIFO,
 * unique key enforcement, DLQ, and cancellation.
 *
 * @example
 * ```typescript
 * const adapter = new MemoryQueueAdapter()
 * const queue = new Queue(adapter, { name: "test-queue" })
 * const worker = new Worker(adapter, { name: "test-queue" })
 * ```
 */

import type {
  CancelJobsFilter,
  FlowNode,
  GetNextJobOptions,
  Job,
  JobStatus,
  JobStatusUpdate,
  NewJob,
  PaginationOptions,
  QueueStats,
  StepState,
} from "../types"
import { BaseQueueAdapter } from "./base"

const TERMINAL_STATUSES = new Set<JobStatus>(["completed", "cancelled", "dead"])
const CANCELLABLE_STATUSES = new Set<JobStatus>([
  "pending",
  "delayed",
  "processing",
  "failed",
])

export class MemoryQueueAdapter extends BaseQueueAdapter {
  private jobs = new Map<string, Job>()
  private connected = false

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.jobs.clear()
  }

  // ─── Job CRUD ──────────────────────────────────────────────

  async addJob(job: NewJob): Promise<Job> {
    const id = BaseQueueAdapter.generateId()
    const createdAt = new Date()

    const newJob: Job = {
      ...job,
      createdAt,
      id,
      progress: job.progress ?? 0,
      repeatCount: job.repeatCount ?? 0,
    }

    this.jobs.set(id, newJob)
    return newJob
  }

  async addJobs(jobs: readonly NewJob[]): Promise<readonly Job[]> {
    return jobs.map((job) => {
      const id = BaseQueueAdapter.generateId()
      const createdAt = new Date()

      const newJob: Job = {
        ...job,
        createdAt,
        id,
        progress: job.progress ?? 0,
        repeatCount: job.repeatCount ?? 0,
      }

      this.jobs.set(id, newJob)
      return newJob
    })
  }

  async getJobById(id: string): Promise<Job | null> {
    return this.jobs.get(id) ?? null
  }

  // ─── Job Picking ───────────────────────────────────────────

  async getNextJob(options: GetNextJobOptions): Promise<Job | null> {
    const now = new Date()

    // First: promote delayed jobs that are ready
    for (const job of this.jobs.values()) {
      if (
        job.status === "delayed" &&
        job.processAt <= now &&
        options.handlerNames.includes(job.name) // oxlint-disable-line react-doctor/js-set-map-lookups -- handlerNames is small and from config
      ) {
        const updated: Job = { ...job, status: "pending" }
        this.jobs.set(job.id, updated)
      }
    }

    // Then: find the next pending job respecting handler names, group constraints, and dependencies
    const candidates = [...this.jobs.values()]
      .filter((job) => {
        if (job.status !== "pending") {
          return false
        }
        if (!options.handlerNames.includes(job.name)) {
          return false
        }
        if (job.groupKey && options.activeGroups.includes(job.groupKey)) {
          return false
        }
        // Skip jobs whose dependencies are not yet resolved
        // (let through jobs with failed/dead/cancelled deps so the worker can cascade)
        if (job.dependsOn && job.dependsOn.length > 0) {
          for (const depId of job.dependsOn) {
            const dep = this.jobs.get(depId)
            if (!dep) {
              return false
            }
            // Dep is still active (not completed, not terminally failed) — block picking
            if (
              dep.status !== "completed" &&
              dep.status !== "dead" &&
              dep.status !== "cancelled" &&
              dep.status !== "failed"
            ) {
              return false
            }
            // If dep completed, this dependency is satisfied — continue checking others
            // If dep is dead/cancelled/failed, let the worker handle the cascade
          }
        }
        return true
      })
      .toSorted((a, b) => {
        const priorityDiff = a.priority - b.priority
        return priorityDiff === 0
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : priorityDiff
      })

    return candidates[0] ?? null
  }

  async getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    const now = new Date()

    // Promote delayed jobs that are ready for this handler
    for (const job of this.jobs.values()) {
      if (
        job.status === "delayed" &&
        job.processAt <= now &&
        job.name === handlerName
      ) {
        const updated: Job = { ...job, status: "pending" }
        this.jobs.set(job.id, updated)
      }
    }

    return [...this.jobs.values()]
      .filter((job) => {
        if (job.status !== "pending") {
          return false
        }
        if (job.name !== handlerName) {
          return false
        }
        if (job.groupKey && groupConstraints.includes(job.groupKey)) {
          return false
        }
        // Skip jobs with unmet dependencies
        if (job.dependsOn && job.dependsOn.length > 0) {
          for (const depId of job.dependsOn) {
            const dep = this.jobs.get(depId)
            if (!dep || dep.status !== "completed") {
              return false
            }
          }
        }
        return true
      })
      .toSorted((a, b) => {
        const priorityDiff = a.priority - b.priority
        return priorityDiff === 0
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : priorityDiff
      })
      .slice(0, count)
  }

  // ─── Status Updates ────────────────────────────────────────

  async updateJobStatus(id: string, update: JobStatusUpdate): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) {
      return
    }

    const now = new Date()
    const updated: Job = {
      ...job,
      cancellationReason: update.cancellationReason ?? job.cancellationReason,
      cancelledAt: update.status === "cancelled" ? now : job.cancelledAt,
      completedAt: update.status === "completed" ? now : job.completedAt,
      error: update.error ?? job.error,
      failedAt: update.status === "failed" ? now : job.failedAt,
      processAt: update.processAt ?? job.processAt,
      processedAt: update.status === "processing" ? now : job.processedAt,
      result: update.result === undefined ? job.result : update.result,
      status: update.status,
    }

    this.jobs.set(id, updated)
  }

  async incrementJobAttempts(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) {
      return
    }

    this.jobs.set(id, { ...job, attempts: job.attempts + 1 })
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) {
      return
    }

    const normalizedProgress = Math.max(0, Math.min(100, progress))
    this.jobs.set(id, { ...job, progress: normalizedProgress })
  }

  // ─── Cancellation ──────────────────────────────────────────

  async cancelJob(id: string, reason?: string): Promise<boolean> {
    const job = this.jobs.get(id)
    if (!job) {
      return false
    }
    if (!CANCELLABLE_STATUSES.has(job.status)) {
      return false
    }

    const now = new Date()
    this.jobs.set(id, {
      ...job,
      cancellationReason: reason,
      cancelledAt: now,
      status: "cancelled",
    })

    return true
  }

  async cancelJobs(filter: CancelJobsFilter): Promise<number> {
    let count = 0

    for (const [id, job] of this.jobs.entries()) {
      if (filter.name && job.name !== filter.name) {
        continue
      }
      if (filter.status && job.status !== filter.status) {
        continue
      }
      if (filter.group && job.groupKey !== filter.group) {
        continue
      }
      if (!CANCELLABLE_STATUSES.has(job.status)) {
        continue
      }

      const now = new Date()
      this.jobs.set(id, {
        ...job,
        cancelledAt: now,
        status: "cancelled",
      })
      count += 1
    }

    return count
  }

  // ─── Dead-Letter Queue ─────────────────────────────────────

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    return [...this.jobs.values()]
      .filter((job) => job.status === "dead")
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit)
  }

  async redriveJob(id: string): Promise<void> {
    const job = this.jobs.get(id)
    if (!job || job.status !== "dead") {
      return
    }

    this.jobs.set(id, {
      ...job,
      attempts: 0,
      error: undefined,
      failedAt: undefined,
      processAt: new Date(),
      progress: 0,
      status: "pending",
    })
  }

  async redriveJobs(filter?: { name?: string }): Promise<number> {
    let count = 0

    for (const [id, job] of this.jobs.entries()) {
      if (job.status !== "dead") {
        continue
      }
      if (filter?.name && job.name !== filter.name) {
        continue
      }

      this.jobs.set(id, {
        ...job,
        attempts: 0,
        error: undefined,
        failedAt: undefined,
        processAt: new Date(),
        progress: 0,
        status: "pending",
      })
      count += 1
    }

    return count
  }

  // ─── Statistics & Queries ──────────────────────────────────

  async getQueueStats(): Promise<QueueStats> {
    const stats = {
      cancelled: 0,
      completed: 0,
      dead: 0,
      delayed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      "waiting-children": 0,
    }

    for (const job of this.jobs.values()) {
      if (job.status in stats) {
        stats[job.status as keyof typeof stats] += 1
      }
    }

    return stats
  }

  async size(): Promise<number> {
    let count = 0
    for (const job of this.jobs.values()) {
      if (job.status === "pending" || job.status === "delayed") {
        count += 1
      }
    }
    return count
  }

  async getJobs(options: {
    status?: JobStatus
    name?: string
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0

    let results = [...this.jobs.values()]

    if (options.status) {
      results = results.filter((job) => job.status === options.status)
    }
    if (options.name) {
      results = results.filter((job) => job.name === options.name)
    }

    return results
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit)
  }

  async getFlows(
    options?: PaginationOptions
  ): Promise<readonly { flowId: string; rootJob: Job }[]> {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const flowMap = new Map<string, Job>()
    for (const job of this.jobs.values()) {
      if (job.flowId && !job.parentId) {
        flowMap.set(job.flowId, job)
      }
    }

    return [...flowMap.entries()]
      .toSorted(([, a], [, b]) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit)
      .map(([flowId, job]) => ({ flowId, rootJob: job }))
  }

  // ─── Cleanup ───────────────────────────────────────────────

  async clearJobs(status?: JobStatus): Promise<number> {
    if (!status) {
      const count = this.jobs.size
      this.jobs.clear()
      return count
    }

    let count = 0
    for (const [id, job] of this.jobs.entries()) {
      if (job.status === status) {
        this.jobs.delete(id)
        count += 1
      }
    }

    return count
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    const jobsToDelete = [...this.jobs.values()]
      .filter((job) => job.status === status)
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(keepCount)

    for (const job of jobsToDelete) {
      this.jobs.delete(job.id)
    }

    return jobsToDelete.length
  }

  // ─── Unique Jobs ───────────────────────────────────────────

  async findJobByUniqueKey(uniqueKey: string): Promise<Job | null> {
    for (const job of this.jobs.values()) {
      if (job.uniqueKey === uniqueKey && !TERMINAL_STATUSES.has(job.status)) {
        return job
      }
    }

    return null
  }

  // ─── Single Job Operations ─────────────────────────────────

  async retryJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id)
    if (!job || job.status !== "failed") {
      return false
    }

    this.jobs.set(id, {
      ...job,
      attempts: 0,
      error: undefined,
      failedAt: undefined,
      processAt: new Date(),
      progress: 0,
      status: "pending",
    })

    return true
  }

  async runJobNow(id: string): Promise<boolean> {
    const job = this.jobs.get(id)
    if (!job || job.status !== "delayed") {
      return false
    }

    this.jobs.set(id, {
      ...job,
      processAt: new Date(),
      status: "pending",
    })

    return true
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id)
  }

  // ─── Transactions ──────────────────────────────────────────

  // eslint-disable-next-line class-methods-use-this
  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return fn()
  }

  // ─── Steps ─────────────────────────────────────────────────

  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    const job = this.jobs.get(id)
    if (!job) {
      return
    }

    this.jobs.set(id, { ...job, steps })
  }

  async setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean> {
    const job = this.jobs.get(id)
    if (!job) {
      return false
    }

    const signals = { ...job.signals, [event]: data }
    this.jobs.set(id, {
      ...job,
      processAt: new Date(),
      signals,
      status: "pending",
    })
    return true
  }

  // ─── Flows ─────────────────────────────────────────────────

  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    const flowJobs = [...this.jobs.values()].filter((j) => j.flowId === flowId)
    if (flowJobs.length === 0) {
      return null
    }

    // Find root (no parentId)
    const root = flowJobs.find((j) => !j.parentId)
    if (!root) {
      return null
    }

    const buildNode = (job: Job): FlowNode => {
      const children = flowJobs.filter((j) => j.parentId === job.id)
      return {
        children: children.map((child) => buildNode(child)),
        job,
      }
    }

    return buildNode(root)
  }

  async incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }> {
    const job = this.jobs.get(parentId)
    if (!job) {
      return { completed: 0, total: 0 }
    }

    const completed = (job.childrenCompleted ?? 0) + 1
    this.jobs.set(parentId, { ...job, childrenCompleted: completed })

    return { completed, total: job.childrenCount ?? 0 }
  }

  async getChildrenJobs(parentId: string): Promise<readonly Job[]> {
    return [...this.jobs.values()].filter((j) => j.parentId === parentId)
  }
}
