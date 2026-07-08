import type {
  AdapterProps,
  CancelJobsFilter,
  FlowNode,
  GetNextJobOptions,
  Job,
  JobStatus,
  JobStatusUpdate,
  NewJob,
  PaginationOptions,
  QueueStats,
  SerializedError,
  StepState,
} from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"

import type { PrismaClient, PrismaClientInternal } from "../types"

interface RawQueueJob {
  id: string
  queue_name: string
  name: string
  payload: unknown
  status: string
  priority: number
  attempts: number
  max_attempts: number
  timeout: number | null
  progress: number
  group_key: string | null
  unique_key: string | null
  cron: string | null
  repeat_every: number | null
  repeat_limit: number | null
  repeat_count: number
  cancellation_reason: string | null
  error: unknown
  result: unknown
  created_at: Date
  process_at: Date
  processed_at: Date | null
  completed_at: Date | null
  failed_at: Date | null
  cancelled_at: Date | null
}

/**
 * PostgreSQL adapter using Prisma ORM.
 *
 * @example
 * ```typescript
 * import { PrismaClient } from "@prisma/client"
 * import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
 *
 * const prisma = new PrismaClient()
 * const adapter = new PostgresPrismaQueueAdapter(prisma)
 * ```
 */
export class PostgresPrismaQueueAdapter extends BaseQueueAdapter {
  private db: PrismaClientInternal
  private modelName: string
  private tableName: string
  private schemaName?: string

  constructor(prisma: PrismaClient, adapterConfig?: AdapterProps<"prisma">) {
    super()
    this.db = prisma as PrismaClientInternal
    this.modelName = adapterConfig?.modelName ?? "QueueJob"
    this.tableName = adapterConfig?.tableName ?? "queue_jobs"
    this.schemaName = adapterConfig?.schemaName
  }

  private get fullTable(): string {
    return this.schemaName
      ? `"${this.schemaName}"."${this.tableName}"`
      : `"${this.tableName}"`
  }

  async connect(): Promise<void> {
    await this.db.$connect()
  }

  async disconnect(): Promise<void> {
    await this.db.$disconnect()
  }

  async addJob(job: NewJob): Promise<Job> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.create({
      data: {
        queueName: this.queueName,
        name: job.name,
        payload: JSON.stringify(job.payload),
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        processAt: job.processAt,
        progress: job.progress ?? 0,
        cron: job.cron ?? null,
        repeatEvery: job.repeatEvery ?? null,
        repeatLimit: job.repeatLimit ?? null,
        repeatCount: job.repeatCount ?? 0,
        timeout: typeof job.timeout === "number" ? job.timeout : null,
        groupKey: job.groupKey ?? null,
        uniqueKey: job.uniqueKey ?? null,
      },
    })

    return PostgresPrismaQueueAdapter.transformPrismaJob(result)
  }

  async addJobs(jobs: readonly NewJob[]): Promise<readonly Job[]> {
    if (jobs.length === 0) {
      return []
    }

    const results: Job[] = []
    for (const job of jobs) {
      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential inserts to maintain ordering
      const created = await this.addJob(job)
      results.push(created)
    }
    return results
  }

  async getJobById(id: string): Promise<Job | null> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.findFirst({
      where: { id, queueName: this.queueName },
    })

    return result ? PostgresPrismaQueueAdapter.transformPrismaJob(result) : null
  }

  async getNextJob(options: GetNextJobOptions): Promise<Job | null> {
    const handlerList = options.handlerNames.map((n) => `'${n}'`).join(", ")

    // Promote delayed jobs
    const delayed = await this.db.$queryRawUnsafe<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'delayed' AND process_at <= NOW()
         AND name IN (${handlerList})
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      this.queueName
    )

    if (delayed.length > 0) {
      await this.db.$queryRawUnsafe(
        `UPDATE ${this.fullTable} SET status = 'pending' WHERE id = $1`,
        delayed[0]?.id
      )
    }

    // Build group exclusion
    let groupClause = ""
    if (options.activeGroups.length > 0) {
      const groupList = options.activeGroups.map((g) => `'${g}'`).join(", ")
      groupClause = `AND (group_key IS NULL OR group_key NOT IN (${groupList}))`
    }

    const results = await this.db.$queryRawUnsafe<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending'
         AND name IN (${handlerList})
         ${groupClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      this.queueName
    )

    const [first] = results
    return first ? PostgresPrismaQueueAdapter.transformRawJob(first) : null
  }

  async getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    let groupClause = ""
    if (groupConstraints.length > 0) {
      const groupList = groupConstraints.map((g) => `'${g}'`).join(", ")
      groupClause = `AND (group_key IS NULL OR group_key NOT IN (${groupList}))`
    }

    const results = await this.db.$queryRawUnsafe<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending' AND name = $2
         ${groupClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT ${count} FOR UPDATE SKIP LOCKED`,
      this.queueName,
      handlerName
    )

    return results.map((row) => PostgresPrismaQueueAdapter.transformRawJob(row))
  }

  async updateJobStatus(id: string, update: JobStatusUpdate): Promise<void> {
    const now = new Date()
    const data: Record<string, unknown> = { status: update.status }

    if (update.error) {
      data.error = update.error
    }
    if (update.result !== undefined) {
      data.result = update.result
    }
    if (update.processAt) {
      data.processAt = update.processAt
    }
    if (update.cancellationReason) {
      data.cancellationReason = update.cancellationReason
    }
    if (update.status === "processing") {
      data.processedAt = now
    }
    if (update.status === "completed") {
      data.completedAt = now
    }
    if (update.status === "failed") {
      data.failedAt = now
    }
    if (update.status === "cancelled") {
      data.cancelledAt = now
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({ where: { id }, data })
  }

  async incrementJobAttempts(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, progress))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: { progress: normalized },
    })
  }

  async cancelJob(id: string, reason?: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const job = await this.db[this.modelName]!.findFirst({
      where: { id, queueName: this.queueName },
    })

    if (!job) {
      return false
    }
    const cancellable = ["pending", "delayed", "processing", "failed"]
    if (!cancellable.includes(job.status as string)) {
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: reason ?? null,
      },
    })

    return true
  }

  async cancelJobs(filter: CancelJobsFilter): Promise<number> {
    const where: Record<string, unknown> = {
      queueName: this.queueName,
      status: { in: ["pending", "delayed", "processing", "failed"] },
    }

    if (filter.name) {
      where.name = filter.name
    }
    if (filter.status) {
      where.status = filter.status
    }
    if (filter.group) {
      where.groupKey = filter.group
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.updateMany({
      where,
      data: { status: "cancelled", cancelledAt: new Date() },
    })

    return result.count ?? 0
  }

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const results = await this.db[this.modelName]!.findMany({
      where: { queueName: this.queueName, status: "dead" },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    })

    return results.map((r: unknown) =>
      PostgresPrismaQueueAdapter.transformPrismaJob(r)
    )
  }

  async redriveJob(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: {
        status: "pending",
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
      },
    })
  }

  async redriveJobs(filter?: { name?: string }): Promise<number> {
    const where: Record<string, unknown> = {
      queueName: this.queueName,
      status: "dead",
    }
    if (filter?.name) {
      where.name = filter.name
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.updateMany({
      where,
      data: {
        status: "pending",
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
      },
    })

    return result.count ?? 0
  }

  async getQueueStats(): Promise<QueueStats> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stats = await this.db[this.modelName]!.groupBy({
      by: ["status"],
      where: { queueName: this.queueName },
      _count: { status: true },
    })

    const result = {
      pending: 0,
      delayed: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      dead: 0,
      "waiting-children": 0,
    }
    for (const stat of stats) {
      const status = stat.status as string
      if (status in result) {
        result[status as keyof typeof result] = Number(stat._count.status)
      }
    }
    return result
  }

  async size(): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.db[this.modelName]!.count({
      where: {
        queueName: this.queueName,
        status: { in: ["pending", "delayed"] },
      },
    })
  }

  async getJobs(options: {
    status?: JobStatus
    name?: string
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const where: Record<string, unknown> = { queueName: this.queueName }

    if (options.status) {
      where.status = options.status
    }
    if (options.name) {
      where.name = options.name
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.modelName]!.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    })

    return (rows as unknown[]).map((r) =>
      PostgresPrismaQueueAdapter.transformPrismaJob(r)
    )
  }

  async getFlows(
    options?: PaginationOptions
  ): Promise<readonly { flowId: string; rootJob: Job }[]> {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.modelName]!.findMany({
      where: {
        queueName: this.queueName,
        flowId: { not: null },
        parentId: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    })

    return (rows as unknown[]).map((r) => {
      const job = PostgresPrismaQueueAdapter.transformPrismaJob(r)
      // oxlint-disable-next-line typescript/no-non-null-assertion
      return { flowId: job.flowId!, rootJob: job }
    })
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const where: Record<string, unknown> = { queueName: this.queueName }
    if (status) {
      where.status = status
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.deleteMany({ where })
    return result.count
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jobsToDelete = await this.db[this.modelName]!.findMany({
      where: { queueName: this.queueName, status },
      orderBy: { createdAt: "desc" },
      skip: keepCount,
      select: { id: true },
    })

    if (jobsToDelete.length === 0) {
      return 0
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.deleteMany({
      where: { id: { in: jobsToDelete.map((j: { id: string }) => j.id) } },
    })

    return result.count
  }

  async findJobByUniqueKey(uniqueKey: string): Promise<Job | null> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.findFirst({
      where: {
        queueName: this.queueName,
        uniqueKey,
        status: { notIn: ["completed", "cancelled", "dead"] },
      },
    })

    return result ? PostgresPrismaQueueAdapter.transformPrismaJob(result) : null
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.db.$transaction(async () => fn())
  }

  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: { steps: JSON.stringify(steps) },
    })
  }

  async retryJob(id: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const job = await this.db[this.modelName]!.findFirst({
      where: { id, queueName: this.queueName, status: "failed" },
    })
    if (!job) {
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: {
        status: "pending",
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
      },
    })
    return true
  }

  async runJobNow(id: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const job = await this.db[this.modelName]!.findFirst({
      where: { id, queueName: this.queueName, status: "delayed" },
    })
    if (!job) {
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: { status: "pending", processAt: new Date() },
    })
    return true
  }

  async deleteJob(id: string): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await this.db[this.modelName]!.delete({ where: { id } })
      return true
    } catch {
      return false
    }
  }

  async setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const job = await this.db[this.modelName]!.findFirst({
      where: { id, queueName: this.queueName },
    })
    if (!job) {
      return false
    }

    const existing = (
      job.signals ? JSON.parse(job.signals as string) : {}
    ) as Record<string, unknown>
    const signals = { ...existing, [event]: data }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: {
        signals: JSON.stringify(signals),
        status: "pending",
        processAt: new Date(),
      },
    })
    return true
  }

  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jobs = await this.db[this.modelName]!.findMany({
      where: { queueName: this.queueName, flowId },
    })
    if (jobs.length === 0) {
      return null
    }

    const allJobs = jobs.map((j: unknown) =>
      PostgresPrismaQueueAdapter.transformPrismaJob(j)
    )
    const root = allJobs.find((j: Job) => !j.parentId)
    if (!root) {
      return null
    }

    const buildNode = (job: Job): FlowNode => {
      const children = allJobs.filter((j: Job) => j.parentId === job.id)
      return { job, children: children.map((c: Job) => buildNode(c)) }
    }
    return buildNode(root)
  }

  async incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const updated = await this.db[this.modelName]!.update({
      where: { id: parentId },
      data: { childrenCompleted: { increment: 1 } },
    })
    return {
      completed: updated.childrenCompleted ?? 0,
      total: updated.childrenCount ?? 0,
    }
  }

  async getChildrenJobs(parentId: string): Promise<readonly Job[]> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jobs = await this.db[this.modelName]!.findMany({
      where: { queueName: this.queueName, parentId },
    })
    return jobs.map((j: unknown) =>
      PostgresPrismaQueueAdapter.transformPrismaJob(j)
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static transformPrismaJob(job: any): Job {
    return {
      id: job.id,
      name: job.name,
      payload:
        typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload,
      status: job.status as JobStatus,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      processAt: job.processAt,
      processedAt: job.processedAt ?? undefined,
      completedAt: job.completedAt ?? undefined,
      failedAt: job.failedAt ?? undefined,
      cancelledAt: job.cancelledAt ?? undefined,
      error: job.error as SerializedError | undefined,
      result: job.result ?? undefined,
      progress: job.progress ?? 0,
      cron: job.cron ?? undefined,
      repeatEvery: job.repeatEvery ?? undefined,
      repeatLimit: job.repeatLimit ?? undefined,
      repeatCount: job.repeatCount ?? 0,
      timeout: job.timeout ?? undefined,
      groupKey: job.groupKey ?? undefined,
      uniqueKey: job.uniqueKey ?? undefined,
      cancellationReason: job.cancellationReason ?? undefined,
    }
  }

  private static transformRawJob(job: RawQueueJob): Job {
    return {
      id: job.id,
      name: job.name,
      payload:
        typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload,
      status: job.status as JobStatus,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      createdAt: job.created_at,
      processAt: job.process_at,
      processedAt: job.processed_at ?? undefined,
      completedAt: job.completed_at ?? undefined,
      failedAt: job.failed_at ?? undefined,
      cancelledAt: job.cancelled_at ?? undefined,
      error: job.error as SerializedError | undefined,
      result: job.result ?? undefined,
      progress: job.progress ?? 0,
      cron: job.cron ?? undefined,
      repeatEvery: job.repeat_every ?? undefined,
      repeatLimit: job.repeat_limit ?? undefined,
      repeatCount: job.repeat_count ?? 0,
      timeout: job.timeout ?? undefined,
      groupKey: job.group_key ?? undefined,
      uniqueKey: job.unique_key ?? undefined,
      cancellationReason: job.cancellation_reason ?? undefined,
    }
  }
}
