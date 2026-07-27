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

import type { JobWhereInput } from "@vorsteh-queue/query-builder"
import { matchesWhere, normalizeWhere } from "@vorsteh-queue/query-builder"

import type {
  FlowAdapter,
  FlowListOptions,
  FlowNode,
  FlowNodeUpdate,
  FlowSummary,
  FlowTree,
  NewFlowNode,
} from "../flow-types"
import type {
  CancelJobsFilter,
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

export class MemoryQueueAdapter
  extends BaseQueueAdapter
  implements FlowAdapter
{
  private jobs = new Map<string, Job>()
  private readonly flowNodes = new Map<string, FlowNode>()
  private connected = false

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.jobs.clear()
    this.flowNodes.clear()
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
        if (job.attempts >= job.maxAttempts) {
          // Exhausted retries — move to dead instead of pending
          this.jobs.set(job.id, { ...job, status: "dead" })
        } else {
          const updated: Job = { ...job, status: "pending" }
          this.jobs.set(job.id, updated)
        }
      }
    }

    // Then: find the next pending job respecting handler names and group constraints
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
        if (job.attempts >= job.maxAttempts) {
          this.jobs.set(job.id, { ...job, status: "dead" })
        } else {
          const updated: Job = { ...job, status: "pending" }
          this.jobs.set(job.id, updated)
        }
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
    }

    for (const job of this.jobs.values()) {
      if (job.status in stats) {
        stats[job.status as keyof typeof stats] += 1
      }
    }

    return stats
  }

  async size(where?: JobWhereInput): Promise<number> {
    const normalized = normalizeWhere(where)
    const hasFilter = Object.keys(normalized).length > 0

    let count = 0
    for (const job of this.jobs.values()) {
      if (hasFilter) {
        // When filter provided, count all matching jobs
        if (matchesWhere(job, normalized)) {
          count += 1
        }
      } else if (job.status === "pending" || job.status === "delayed") {
        // Default behavior: count pending + delayed
        count += 1
      }
    }
    return count
  }

  async getJobs(options: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const normalized = normalizeWhere(options.where)

    let results = [...this.jobs.values()]

    // Apply where filter if any conditions are specified
    if (Object.keys(normalized).length > 0) {
      results = results.filter((job) => matchesWhere(job, normalized))
    }

    return results
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit)
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

  // ─── Flow Adapter ──────────────────────────────────────────

  async createFlow(
    nodes: readonly NewFlowNode[],
    leafJobs: readonly NewJob[]
  ): Promise<readonly FlowNode[]> {
    const createdNodes: FlowNode[] = []
    const now = new Date()

    for (const node of nodes) {
      const flowNode: FlowNode = {
        ...node,
        createdAt: now,
      }
      this.flowNodes.set(node.id, flowNode)
      createdNodes.push(flowNode)
    }

    // Create leaf jobs (they have flowNodeId set)
    for (const job of leafJobs) {
      await this.addJob(job)
    }

    // Correlate: for leaf nodes that are "ready", find their job by flowNodeId
    for (let i = 0; i < createdNodes.length; i++) {
      const node = createdNodes[i]
      if (!node || node.status !== "ready") {
        continue
      }

      const matchingJob = [...this.jobs.values()].find(
        (j) => j.flowNodeId === node.id
      )
      if (matchingJob) {
        const updated: FlowNode = { ...node, jobId: matchingJob.id }
        this.flowNodes.set(node.id, updated)
        createdNodes[i] = updated
      }
    }

    return createdNodes
  }

  async getFlowNode(nodeId: string): Promise<FlowNode | null> {
    return this.flowNodes.get(nodeId) ?? null
  }

  async getFlowTree(flowId: string): Promise<FlowTree | null> {
    const allNodes = [...this.flowNodes.values()].filter(
      (n) => n.flowId === flowId
    )
    if (allNodes.length === 0) {
      return null
    }

    const rootNode = allNodes.find((n) => !n.parentNodeId)
    if (!rootNode) {
      return null
    }

    const buildTree = (node: FlowNode): FlowTree => {
      const children = allNodes
        .filter((n) => n.parentNodeId === node.id)
        .map(buildTree)
      return { node, children }
    }

    return buildTree(rootNode)
  }

  async getFlows(options?: FlowListOptions): Promise<readonly FlowSummary[]> {
    // Group by flowId, find root nodes
    const flowIds = new Set<string>()
    for (const node of this.flowNodes.values()) {
      flowIds.add(node.flowId)
    }

    let summaries: FlowSummary[] = []
    for (const flowId of flowIds) {
      const rootNode = [...this.flowNodes.values()].find(
        (n) => n.flowId === flowId && !n.parentNodeId
      )
      if (!rootNode) {
        continue
      }

      if (options?.status && rootNode.status !== options.status) {
        continue
      }

      summaries.push({
        completedAt: rootNode.completedAt,
        createdAt: rootNode.createdAt,
        flowId,
        rootNode,
        status: rootNode.status,
      })
    }

    // Sort by createdAt descending
    summaries = summaries.toSorted(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    )

    // Apply pagination
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 50
    return summaries.slice(offset, offset + limit)
  }

  async updateFlowNode(nodeId: string, update: FlowNodeUpdate): Promise<void> {
    const existing = this.flowNodes.get(nodeId)
    if (!existing) {
      return
    }

    const updated: FlowNode = {
      ...existing,
      ...(update.status !== undefined && { status: update.status }),
      ...(update.jobId !== undefined && { jobId: update.jobId }),
      ...(update.result !== undefined && { result: update.result }),
      ...(update.error !== undefined && { error: update.error }),
      ...(update.completedAt !== undefined && {
        completedAt: update.completedAt,
      }),
    }
    this.flowNodes.set(nodeId, updated)
  }

  async incrementNodeChildrenCompleted(
    nodeId: string
  ): Promise<{ completed: number; total: number }> {
    const node = this.flowNodes.get(nodeId)
    if (!node) {
      return { completed: 0, total: 0 }
    }

    const updated: FlowNode = {
      ...node,
      childrenCompleted: node.childrenCompleted + 1,
    }
    this.flowNodes.set(nodeId, updated)
    return {
      completed: updated.childrenCompleted,
      total: updated.childrenCount,
    }
  }

  async getNodeChildren(nodeId: string): Promise<readonly FlowNode[]> {
    return [...this.flowNodes.values()].filter((n) => n.parentNodeId === nodeId)
  }

  async getChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const children = await this.getNodeChildren(nodeId)
    const results = new Map<string, unknown>()
    for (const child of children) {
      if (child.status === "completed" && child.result !== undefined) {
        results.set(child.id, child.result)
      }
    }
    return results
  }

  async getFailedChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const children = await this.getNodeChildren(nodeId)
    const results = new Map<string, unknown>()
    for (const child of children) {
      if (child.status === "failed" && child.error !== undefined) {
        results.set(child.id, child.error)
      }
    }
    return results
  }

  async cancelUnprocessedChildren(nodeId: string): Promise<number> {
    let cancelled = 0
    const children = await this.getNodeChildren(nodeId)

    for (const child of children) {
      if (child.jobId) {
        const job = this.jobs.get(child.jobId)
        if (job && (job.status === "pending" || job.status === "delayed")) {
          await this.cancelJob(
            child.jobId,
            "Cancelled by removeUnprocessedChildren"
          )
          await this.updateFlowNode(child.id, {
            completedAt: new Date(),
            status: "cancelled",
          })
          cancelled++
          cancelled += await this.cancelUnprocessedChildren(child.id)
        }
      } else if (child.status === "waiting") {
        await this.updateFlowNode(child.id, {
          completedAt: new Date(),
          status: "cancelled",
        })
        cancelled++
        cancelled += await this.cancelUnprocessedChildren(child.id)
      }
    }

    return cancelled
  }

  async deleteFlow(flowId: string): Promise<number> {
    let deleted = 0
    for (const [id, node] of this.flowNodes) {
      if (node.flowId === flowId) {
        this.flowNodes.delete(id)
        deleted++
      }
    }
    return deleted
  }

  async cleanupFlows(keepCount: number): Promise<number> {
    const completedRoots = [...this.flowNodes.values()]
      .filter((n) => !n.parentNodeId && n.status === "completed")
      .toSorted(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0)
      )

    if (completedRoots.length <= keepCount) {
      return 0
    }

    const toDelete = completedRoots.slice(keepCount)
    let totalDeleted = 0
    for (const root of toDelete) {
      totalDeleted += await this.deleteFlow(root.flowId)
    }
    return totalDeleted
  }
}
