import type {
  AdapterProps,
  CancelJobsFilter,
  FlowAdapter,
  FlowListOptions,
  FlowNode,
  FlowNodeUpdate,
  FlowSummary,
  FlowTree,
  GetNextJobOptions,
  Job,
  JobStatus,
  JobStatusUpdate,
  NewFlowNode,
  NewJob,
  PaginationOptions,
  QueueStats,
  SerializedError,
  StepState,
} from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"
import type { JobWhereInput } from "@vorsteh-queue/query-builder"
import { normalizeWhere } from "@vorsteh-queue/query-builder"
import { buildWhere } from "@vorsteh-queue/query-builder/prisma"

import type { PrismaClient, PrismaClientInternal } from "../types"

/** Allowed pattern for SQL identifiers: letters, digits, underscores only. */
const VALID_IDENTIFIER_PATTERN = /^[a-zA-Z0-9_]+$/

/**
 * Validate that a string is a safe SQL identifier.
 *
 * @param value - The identifier to validate
 * @param label - Human-readable label for error messages
 * @throws {Error} If the identifier contains characters outside [a-zA-Z0-9_]
 */
function assertValidIdentifier(value: string, label: string): void {
  if (!VALID_IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". Only alphanumeric characters and underscores are allowed.`
    )
  }
}

/**
 * Generate positional parameter placeholders for an IN-list.
 *
 * @param values - Array of values to parameterize
 * @param params - Accumulator array for query parameters (mutated in place)
 * @returns SQL fragment like `$2, $3, $4`
 */
function buildInPlaceholders(
  values: readonly unknown[],
  params: unknown[]
): string {
  return values
    .map((value) => {
      params.push(value)
      return `$${params.length}`
    })
    .join(", ")
}

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
  flow_node_id: string | null
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
export class PostgresPrismaQueueAdapter
  extends BaseQueueAdapter
  implements FlowAdapter
{
  private db: PrismaClientInternal
  private modelName: string
  private readonly flowModelName: string
  private readonly fullTable: string
  private readonly fullFlowTable: string

  constructor(prisma: PrismaClient, adapterConfig?: AdapterProps<"prisma">) {
    super()
    this.db = prisma as PrismaClientInternal
    this.modelName = adapterConfig?.modelName ?? "QueueJob"
    this.flowModelName = adapterConfig?.flowModelName ?? "QueueFlow"

    const tableName = adapterConfig?.tableName ?? "queue_jobs"
    const flowTableName = adapterConfig?.flowTableName ?? "queue_flows"
    const schemaName = adapterConfig?.schemaName

    assertValidIdentifier(tableName, "tableName")
    assertValidIdentifier(flowTableName, "flowTableName")
    if (schemaName !== undefined) {
      assertValidIdentifier(schemaName, "schemaName")
    }

    this.fullTable = schemaName
      ? `"${schemaName}"."${tableName}"`
      : `"${tableName}"`
    this.fullFlowTable = schemaName
      ? `"${schemaName}"."${flowTableName}"`
      : `"${flowTableName}"`
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
        attempts: job.attempts,
        cron: job.cron ?? null,
        flowNodeId: job.flowNodeId ?? null,
        groupKey: job.groupKey ?? null,
        maxAttempts: job.maxAttempts,
        name: job.name,
        payload: JSON.stringify(job.payload),
        priority: job.priority,
        processAt: job.processAt,
        progress: job.progress ?? 0,
        queueName: this.queueName,
        repeatCount: job.repeatCount ?? 0,
        repeatEvery: job.repeatEvery ?? null,
        repeatLimit: job.repeatLimit ?? null,
        status: job.status,
        timeout: typeof job.timeout === "number" ? job.timeout : null,
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
    // Guard: no handlers means no jobs can be picked
    if (options.handlerNames.length === 0) {
      return null
    }

    // SECURITY NOTE:
    // We intentionally use $queryRawUnsafe to support FOR UPDATE SKIP LOCKED.
    // All identifiers are strictly validated in the constructor and
    // all dynamic values are parameterized via positional placeholders.

    // Build parameterized IN-list for handler names
    const handlerParams: unknown[] = [this.queueName]
    const handlerInClause = buildInPlaceholders(
      options.handlerNames,
      handlerParams
    )

    // Promote delayed jobs that are ready to process
    const delayed = await this.db.$queryRawUnsafe<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'delayed' AND process_at <= NOW()
         AND name IN (${handlerInClause})
         AND attempts < max_attempts
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      ...handlerParams
    )

    if (delayed.length > 0) {
      await this.db.$queryRawUnsafe(
        `UPDATE ${this.fullTable} SET status = 'pending' WHERE id = $1`,
        delayed[0]?.id
      )
    }

    // Move exhausted delayed jobs to dead (safety net)
    await this.db.$queryRawUnsafe(
      `UPDATE ${this.fullTable} SET status = 'dead'
       WHERE queue_name = $1 AND status = 'delayed' AND process_at <= NOW()
         AND attempts >= max_attempts`,
      this.queueName
    )

    // Build parameterized query for pending jobs
    const pendingParams: unknown[] = [this.queueName]
    const pendingHandlerInClause = buildInPlaceholders(
      options.handlerNames,
      pendingParams
    )

    // Build group exclusion clause (structurally deterministic)
    let groupExclusionClause: string
    if (options.activeGroups.length > 0) {
      const groupInClause = buildInPlaceholders(
        options.activeGroups,
        pendingParams
      )
      groupExclusionClause = `AND (group_key IS NULL OR group_key NOT IN (${groupInClause}))`
    } else {
      groupExclusionClause = ""
    }

    const results = await this.db.$queryRawUnsafe<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending'
         AND name IN (${pendingHandlerInClause})
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      ...pendingParams
    )

    const [first] = results
    return first ? PostgresPrismaQueueAdapter.transformRawJob(first) : null
  }

  async getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    // SECURITY NOTE:
    // We intentionally use $queryRawUnsafe to support FOR UPDATE SKIP LOCKED.
    // All identifiers are strictly validated in the constructor and
    // all dynamic values are parameterized via positional placeholders.

    const params: unknown[] = [this.queueName, handlerName]

    // Build group exclusion clause (structurally deterministic)
    let groupExclusionClause: string
    if (groupConstraints.length > 0) {
      const groupInClause = buildInPlaceholders(groupConstraints, params)
      groupExclusionClause = `AND (group_key IS NULL OR group_key NOT IN (${groupInClause}))`
    } else {
      groupExclusionClause = ""
    }

    // LIMIT as parameterized binding (validated as integer)
    params.push(Math.trunc(Math.max(0, count)))
    const limitParam = `$${params.length}`

    const results = await this.db.$queryRawUnsafe<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending' AND name = $2
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT ${limitParam} FOR UPDATE SKIP LOCKED`,
      ...params
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
    await this.db[this.modelName]!.update({ data, where: { id } })
  }

  async incrementJobAttempts(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      data: { attempts: { increment: 1 } },
      where: { id },
    })
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, progress))
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      data: { progress: normalized },
      where: { id },
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
      data: {
        cancellationReason: reason ?? null,
        cancelledAt: new Date(),
        status: "cancelled",
      },
      where: { id },
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
      data: { cancelledAt: new Date(), status: "cancelled" },
      where,
    })

    return result.count ?? 0
  }

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const results = await this.db[this.modelName]!.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where: { queueName: this.queueName, status: "dead" },
    })

    return results.map((r: unknown) =>
      PostgresPrismaQueueAdapter.transformPrismaJob(r)
    )
  }

  async redriveJob(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      data: {
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
        status: "pending",
      },
      where: { id },
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
      data: {
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
        status: "pending",
      },
      where,
    })

    return result.count ?? 0
  }

  async getQueueStats(): Promise<QueueStats> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stats = await this.db[this.modelName]!.groupBy({
      _count: { status: true },
      by: ["status"],
      where: { queueName: this.queueName },
    })

    const result = {
      cancelled: 0,
      completed: 0,
      dead: 0,
      delayed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
    }
    for (const stat of stats) {
      const status = stat.status as string
      if (status in result) {
        result[status as keyof typeof result] = Number(stat._count.status)
      }
    }
    return result
  }

  async size(where?: JobWhereInput): Promise<number> {
    const normalized = normalizeWhere(where)
    const prismaWhere = buildWhere(normalized)
    const hasFilter = Object.keys(normalized).length > 0

    const prismaWhereClause: Record<string, unknown> = {
      queueName: this.queueName,
    }

    if (hasFilter) {
      // When filter provided, count matching jobs
      Object.assign(prismaWhereClause, prismaWhere)
    } else {
      // Default behavior: count pending + delayed
      prismaWhereClause.status = { in: ["pending", "delayed"] }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.db[this.modelName]!.count({
      where: prismaWhereClause,
    })
  }

  async getJobs(options: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const normalized = normalizeWhere(options.where)
    const prismaWhere = buildWhere(normalized)

    const where: Record<string, unknown> = {
      queueName: this.queueName,
      ...prismaWhere,
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.modelName]!.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    })

    return (rows as unknown[]).map((r) =>
      PostgresPrismaQueueAdapter.transformPrismaJob(r)
    )
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
      orderBy: { createdAt: "desc" },
      select: { id: true },
      skip: keepCount,
      where: { queueName: this.queueName, status },
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
        status: { notIn: ["completed", "cancelled", "dead"] },
        uniqueKey,
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
      data: { steps: JSON.stringify(steps) },
      where: { id },
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
      data: {
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
        status: "pending",
      },
      where: { id },
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
      data: { processAt: new Date(), status: "pending" },
      where: { id },
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
      data: {
        processAt: new Date(),
        signals: JSON.stringify(signals),
        status: "pending",
      },
      where: { id },
    })
    return true
  }

  // oxlint-disable-next-line complexity, typescript/no-explicit-any
  private static transformPrismaJob(job: any): Job {
    return {
      attempts: job.attempts,
      cancellationReason: job.cancellationReason ?? undefined,
      cancelledAt: job.cancelledAt ?? undefined,
      completedAt: job.completedAt ?? undefined,
      createdAt: job.createdAt,
      cron: job.cron ?? undefined,
      error: job.error as SerializedError | undefined,
      failedAt: job.failedAt ?? undefined,
      flowNodeId: job.flowNodeId ?? undefined,
      groupKey: job.groupKey ?? undefined,
      id: job.id,
      maxAttempts: job.maxAttempts,
      name: job.name,
      payload:
        typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload,
      priority: job.priority,
      processAt: job.processAt,
      processedAt: job.processedAt ?? undefined,
      progress: job.progress ?? 0,
      repeatCount: job.repeatCount ?? 0,
      repeatEvery: job.repeatEvery ?? undefined,
      repeatLimit: job.repeatLimit ?? undefined,
      result: job.result ?? undefined,
      status: job.status as JobStatus,
      timeout: job.timeout ?? undefined,
      uniqueKey: job.uniqueKey ?? undefined,
    }
  }

  // oxlint-disable-next-line complexity
  private static transformRawJob(job: RawQueueJob): Job {
    return {
      attempts: job.attempts,
      cancellationReason: job.cancellation_reason ?? undefined,
      cancelledAt: job.cancelled_at ?? undefined,
      completedAt: job.completed_at ?? undefined,
      createdAt: job.created_at,
      cron: job.cron ?? undefined,
      error: job.error as SerializedError | undefined,
      failedAt: job.failed_at ?? undefined,
      flowNodeId: job.flow_node_id ?? undefined,
      groupKey: job.group_key ?? undefined,
      id: job.id,
      maxAttempts: job.max_attempts,
      name: job.name,
      payload:
        typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload,
      priority: job.priority,
      processAt: job.process_at,
      processedAt: job.processed_at ?? undefined,
      progress: job.progress ?? 0,
      repeatCount: job.repeat_count ?? 0,
      repeatEvery: job.repeat_every ?? undefined,
      repeatLimit: job.repeat_limit ?? undefined,
      result: job.result ?? undefined,
      status: job.status as JobStatus,
      timeout: job.timeout ?? undefined,
      uniqueKey: job.unique_key ?? undefined,
    }
  }

  // eslint-disable-next-line class-methods-use-this, typescript/no-explicit-any
  private static transformFlowRow(row: any): FlowNode {
    return {
      id: row.id,
      flowId: row.flowId,
      parentNodeId: row.parentNodeId ?? undefined,
      jobId: row.jobId ?? undefined,
      queueName: row.queueName,
      name: row.name,
      payload:
        typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      options: row.options
        ? typeof row.options === "string"
          ? JSON.parse(row.options)
          : row.options
        : undefined,
      status: row.status as FlowNode["status"],
      failureStrategy: row.failureStrategy as FlowNode["failureStrategy"],
      childrenCount: row.childrenCount,
      childrenCompleted: row.childrenCompleted,
      result: row.result ?? undefined,
      error: row.error as SerializedError | undefined,
      createdAt: row.createdAt,
      completedAt: row.completedAt ?? undefined,
    }
  }

  // ─── FlowAdapter Implementation ──────────────────────────────────────────

  async createFlow(
    nodes: readonly NewFlowNode[],
    leafJobs: readonly NewJob[]
  ): Promise<readonly FlowNode[]> {
    return this.db.$transaction(async (tx: PrismaClientInternal) => {
      // Insert all flow nodes with pre-generated IDs
      for (const n of nodes) {
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop, typescript/no-non-null-assertion -- sequential inserts in transaction
        await tx[this.flowModelName]!.create({
          data: {
            id: n.id,
            flowId: n.flowId,
            parentNodeId: n.parentNodeId ?? null,
            jobId: n.jobId ?? null,
            queueName: n.queueName,
            name: n.name,
            payload: JSON.stringify(n.payload),
            options: n.options ? JSON.stringify(n.options) : null,
            status: n.status,
            failureStrategy: n.failureStrategy,
            childrenCount: n.childrenCount,
            childrenCompleted: n.childrenCompleted,
          },
        })
      }

      // Insert leaf jobs and update their flow nodes with the job ID
      for (const job of leafJobs) {
        const matchingNode = nodes.find((n) => n.id === job.flowNodeId)
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop, typescript/no-non-null-assertion -- sequential inserts in transaction
        const createdJob = await tx[this.modelName]!.create({
          data: {
            attempts: job.attempts,
            cron: job.cron ?? null,
            flowNodeId: job.flowNodeId ?? null,
            groupKey: job.groupKey ?? null,
            maxAttempts: job.maxAttempts,
            name: job.name,
            payload: JSON.stringify(job.payload),
            priority: job.priority,
            processAt: job.processAt,
            progress: job.progress ?? 0,
            queueName: matchingNode?.queueName ?? this.queueName,
            repeatCount: job.repeatCount ?? 0,
            repeatEvery: job.repeatEvery ?? null,
            repeatLimit: job.repeatLimit ?? null,
            status: job.status,
            timeout: typeof job.timeout === "number" ? job.timeout : null,
            uniqueKey: job.uniqueKey ?? null,
          },
        })

        // Update the flow node with the created job ID
        if (createdJob && job.flowNodeId) {
          // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop, typescript/no-non-null-assertion -- sequential updates in transaction
          await tx[this.flowModelName]!.update({
            data: { jobId: createdJob.id },
            where: { id: job.flowNodeId },
          })
        }
      }

      // Re-fetch all nodes to get updated jobId values
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const finalNodes = await tx[this.flowModelName]!.findMany({
        where: { id: { in: nodes.map((n) => n.id) } },
      })

      return (finalNodes as unknown[]).map((r) =>
        PostgresPrismaQueueAdapter.transformFlowRow(r)
      )
    })
  }

  async getFlowNode(nodeId: string): Promise<FlowNode | null> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const row = await this.db[this.flowModelName]!.findFirst({
      where: { id: nodeId },
    })
    return row ? PostgresPrismaQueueAdapter.transformFlowRow(row) : null
  }

  async getFlowTree(flowId: string): Promise<FlowTree | null> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.flowModelName]!.findMany({
      where: { flowId },
    })
    if (rows.length === 0) {
      return null
    }

    const allNodes = (rows as unknown[]).map((r) =>
      PostgresPrismaQueueAdapter.transformFlowRow(r)
    )
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
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const where: Record<string, unknown> = { parentNodeId: null }
    if (options?.status) {
      where.status = options.status
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.flowModelName]!.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    })

    return (rows as unknown[]).map((r) => {
      const node = PostgresPrismaQueueAdapter.transformFlowRow(r)
      return {
        flowId: node.flowId,
        rootNode: node,
        status: node.status,
        createdAt: node.createdAt,
        completedAt: node.completedAt,
      }
    })
  }

  async updateFlowNode(nodeId: string, update: FlowNodeUpdate): Promise<void> {
    const data: Record<string, unknown> = {}

    if (update.status !== undefined) {
      data.status = update.status
    }
    if (update.jobId !== undefined) {
      data.jobId = update.jobId
    }
    if (update.result !== undefined) {
      data.result = update.result
    }
    if (update.error !== undefined) {
      data.error = update.error
    }
    if (update.completedAt !== undefined) {
      data.completedAt = update.completedAt
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.flowModelName]!.update({
      data,
      where: { id: nodeId },
    })
  }

  async incrementNodeChildrenCompleted(
    nodeId: string
  ): Promise<{ completed: number; total: number }> {
    // Use raw SQL to atomically increment and avoid race conditions
    await this.db.$queryRawUnsafe(
      `UPDATE ${this.fullFlowTable} SET children_completed = children_completed + 1 WHERE id = $1`,
      nodeId
    )

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const updated = await this.db[this.flowModelName]!.findFirst({
      where: { id: nodeId },
    })

    if (!updated) {
      return { completed: 0, total: 0 }
    }

    return {
      completed: updated.childrenCompleted ?? 0,
      total: updated.childrenCount ?? 0,
    }
  }

  async getNodeChildren(nodeId: string): Promise<readonly FlowNode[]> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.flowModelName]!.findMany({
      where: { parentNodeId: nodeId },
    })
    return (rows as unknown[]).map((r) =>
      PostgresPrismaQueueAdapter.transformFlowRow(r)
    )
  }

  async getChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.flowModelName]!.findMany({
      where: { parentNodeId: nodeId, status: "completed" },
    })

    const results = new Map<string, unknown>()
    for (const row of rows as { id: string; result: unknown }[]) {
      results.set(row.id, row.result)
    }
    return results
  }

  async getFailedChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.flowModelName]!.findMany({
      where: { parentNodeId: nodeId, status: "failed" },
    })

    const results = new Map<string, unknown>()
    for (const row of rows as { id: string; error: unknown }[]) {
      results.set(row.id, row.error)
    }
    return results
  }

  async cancelUnprocessedChildren(nodeId: string): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const children = await this.db[this.flowModelName]!.findMany({
      where: { parentNodeId: nodeId },
    })

    let cancelled = 0
    const now = new Date()

    for (const child of children as {
      id: string
      status: string
      jobId: string | null
    }[]) {
      if (child.status === "waiting") {
        // Cancel waiting nodes (no job yet)
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop, typescript/no-non-null-assertion -- sequential cancellation
        await this.db[this.flowModelName]!.update({
          data: { status: "cancelled", completedAt: now },
          where: { id: child.id },
        })
        cancelled++
        // Recursively cancel subtree
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- recursive traversal
        cancelled += await this.cancelUnprocessedChildren(child.id)
      } else if (child.status === "ready" && child.jobId) {
        // Cancel the corresponding job if it's still pending/delayed
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop, typescript/no-non-null-assertion -- sequential cancellation
        const result = await this.db[this.modelName]!.updateMany({
          data: { cancelledAt: now, status: "cancelled" },
          where: {
            id: child.jobId,
            status: { in: ["pending", "delayed"] },
          },
        })

        if ((result.count ?? 0) > 0) {
          // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop, typescript/no-non-null-assertion -- sequential cancellation
          await this.db[this.flowModelName]!.update({
            data: { status: "cancelled", completedAt: now },
            where: { id: child.id },
          })
          cancelled++
        }
        // Recursively cancel subtree
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- recursive traversal
        cancelled += await this.cancelUnprocessedChildren(child.id)
      }
    }

    return cancelled
  }

  async deleteFlow(flowId: string): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.flowModelName]!.deleteMany({
      where: { flowId },
    })
    return result.count ?? 0
  }

  async cleanupFlows(keepCount: number): Promise<number> {
    // Find root nodes of completed flows, ordered by creation time
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rootNodes = await this.db[this.flowModelName]!.findMany({
      orderBy: { createdAt: "desc" },
      select: { flowId: true },
      skip: keepCount,
      where: { parentNodeId: null, status: "completed" },
    })

    if (rootNodes.length === 0) {
      return 0
    }

    const flowIdsToDelete = (rootNodes as { flowId: string }[]).map(
      (r) => r.flowId
    )

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.flowModelName]!.deleteMany({
      where: { flowId: { in: flowIdsToDelete } },
    })

    return result.count ?? 0
  }
}
