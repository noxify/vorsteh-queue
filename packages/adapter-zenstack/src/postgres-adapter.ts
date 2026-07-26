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
  SerializedError,
  StepState,
  ZenstackAdapterProps,
} from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"
import type { JobWhereInput } from "@vorsteh-queue/query-builder"
import { normalizeWhere } from "@vorsteh-queue/query-builder"
import { buildWhere } from "@vorsteh-queue/query-builder/zenstack"

import type { ZenStackClient, ZenStackClientInternal } from "../types"

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
  depends_on: unknown
  repeat_every: number | null
  repeat_limit: number | null
  repeat_count: number
  cancellation_reason: string | null
  on_dependency_failure: string | null
  flow_id: string | null
  parent_id: string | null
  children_count: number
  children_completed: number
  fail_parent_on_failure: number
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
 * PostgreSQL adapter using ZenStack ORM.
 *
 * ZenStack v3 provides a Prisma-compatible query API built on Kysely,
 * with additional features like built-in access control, polymorphic
 * models, and a low-level query builder.
 *
 * @example
 * ```typescript
 * import { ZenStackClient } from "@zenstackhq/orm"
 * import { PostgresZenstackQueueAdapter } from "@vorsteh-queue/adapter-zenstack"
 *
 * const db = new ZenStackClient(schema, { dialect })
 * const adapter = new PostgresZenstackQueueAdapter(db)
 * ```
 */
export class PostgresZenstackQueueAdapter extends BaseQueueAdapter {
  private db: ZenStackClientInternal
  private modelName: string
  private readonly fullTable: string

  constructor(client: ZenStackClient, adapterConfig?: ZenstackAdapterProps) {
    super()
    this.db = client as ZenStackClientInternal
    this.modelName = adapterConfig?.modelName ?? "queueJob"

    const tableName = adapterConfig?.tableName ?? "queue_jobs"
    const schemaName = adapterConfig?.schemaName

    assertValidIdentifier(tableName, "tableName")
    if (schemaName !== undefined) {
      assertValidIdentifier(schemaName, "schemaName")
    }

    this.fullTable = schemaName
      ? `"${schemaName}"."${tableName}"`
      : `"${tableName}"`
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
        childrenCompleted: job.childrenCompleted ?? 0,
        childrenCount: job.childrenCount ?? 0,
        cron: job.cron ?? null,
        dependsOn: job.dependsOn ? JSON.stringify(job.dependsOn) : null,
        failParentOnFailure: job.failParentOnFailure ? 1 : 0,
        flowId: job.flowId ?? null,
        groupKey: job.groupKey ?? null,
        maxAttempts: job.maxAttempts,
        name: job.name,
        onDependencyFailure: job.onDependencyFailure ?? null,
        parentId: job.parentId ?? null,
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

    return PostgresZenstackQueueAdapter.transformJob(result)
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

    return result ? PostgresZenstackQueueAdapter.transformJob(result) : null
  }

  async getNextJob(options: GetNextJobOptions): Promise<Job | null> {
    if (options.handlerNames.length === 0) {
      return null
    }

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

    // Build group exclusion clause
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
    return first ? PostgresZenstackQueueAdapter.transformRawJob(first) : null
  }

  async getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    const params: unknown[] = [this.queueName, handlerName]

    // Build group exclusion clause
    let groupExclusionClause: string
    if (groupConstraints.length > 0) {
      const groupInClause = buildInPlaceholders(groupConstraints, params)
      groupExclusionClause = `AND (group_key IS NULL OR group_key NOT IN (${groupInClause}))`
    } else {
      groupExclusionClause = ""
    }

    // LIMIT as parameterized binding
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

    return results.map((row) =>
      PostgresZenstackQueueAdapter.transformRawJob(row)
    )
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
      PostgresZenstackQueueAdapter.transformJob(r)
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

  async size(where?: JobWhereInput): Promise<number> {
    const normalized = normalizeWhere(where)
    const zenstackWhere = buildWhere(normalized)
    const hasFilter = Object.keys(normalized).length > 0

    const whereClause: Record<string, unknown> = {
      queueName: this.queueName,
    }

    if (hasFilter) {
      Object.assign(whereClause, zenstackWhere)
    } else {
      whereClause.status = { in: ["pending", "delayed"] }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.db[this.modelName]!.count({
      where: whereClause,
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
    const zenstackWhere = buildWhere(normalized)

    const where: Record<string, unknown> = {
      queueName: this.queueName,
      ...zenstackWhere,
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.modelName]!.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where,
    })

    return (rows as unknown[]).map((r) =>
      PostgresZenstackQueueAdapter.transformJob(r)
    )
  }

  async getFlows(
    options?: PaginationOptions
  ): Promise<readonly { flowId: string; rootJob: Job }[]> {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const rows = await this.db[this.modelName]!.findMany({
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      where: {
        flowId: { not: null },
        parentId: null,
        queueName: this.queueName,
      },
    })

    return (rows as unknown[]).map((r) => {
      const job = PostgresZenstackQueueAdapter.transformJob(r)
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

    return result ? PostgresZenstackQueueAdapter.transformJob(result) : null
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

  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jobs = await this.db[this.modelName]!.findMany({
      where: { flowId, queueName: this.queueName },
    })
    if (jobs.length === 0) {
      return null
    }

    const allJobs = jobs.map((j: unknown) =>
      PostgresZenstackQueueAdapter.transformJob(j)
    )
    const root = allJobs.find((j: Job) => !j.parentId)
    if (!root) {
      return null
    }

    const buildNode = (job: Job): FlowNode => {
      const children = allJobs.filter((j: Job) => j.parentId === job.id)
      return { children: children.map((c: Job) => buildNode(c)), job }
    }
    return buildNode(root)
  }

  async deleteFlow(flowId: string): Promise<number> {
    const result = await this.db.$queryRawUnsafe<{ id: string }[]>(
      `DELETE FROM ${this.fullTable} WHERE queue_name = $1 AND flow_id = $2 RETURNING id`,
      this.queueName,
      flowId
    )
    return result.length
  }

  async incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const updated = await this.db[this.modelName]!.update({
      data: { childrenCompleted: { increment: 1 } },
      where: { id: parentId },
    })
    return {
      completed: updated.childrenCompleted ?? 0,
      total: updated.childrenCount ?? 0,
    }
  }

  async getChildrenJobs(parentId: string): Promise<readonly Job[]> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jobs = await this.db[this.modelName]!.findMany({
      where: { parentId, queueName: this.queueName },
    })
    return jobs.map((j: unknown) =>
      PostgresZenstackQueueAdapter.transformJob(j)
    )
  }

  // oxlint-disable-next-line complexity, typescript/no-explicit-any
  private static transformJob(job: any): Job {
    return {
      attempts: job.attempts,
      cancellationReason: job.cancellationReason ?? undefined,
      cancelledAt: job.cancelledAt ?? undefined,
      childrenCompleted: job.childrenCompleted ?? 0,
      childrenCount: job.childrenCount ?? 0,
      completedAt: job.completedAt ?? undefined,
      createdAt: job.createdAt,
      cron: job.cron ?? undefined,
      dependsOn: job.dependsOn
        ? ((typeof job.dependsOn === "string"
            ? JSON.parse(job.dependsOn)
            : job.dependsOn) as string[])
        : undefined,
      error: job.error as SerializedError | undefined,
      failParentOnFailure: job.failParentOnFailure === 1 || undefined,
      failedAt: job.failedAt ?? undefined,
      flowId: job.flowId ?? undefined,
      groupKey: job.groupKey ?? undefined,
      id: job.id,
      maxAttempts: job.maxAttempts,
      name: job.name,
      onDependencyFailure:
        (job.onDependencyFailure as "fail" | "cancel") ?? undefined,
      parentId: job.parentId ?? undefined,
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
      childrenCompleted: job.children_completed ?? 0,
      childrenCount: job.children_count ?? 0,
      completedAt: job.completed_at ?? undefined,
      createdAt: job.created_at,
      cron: job.cron ?? undefined,
      dependsOn: job.depends_on
        ? ((typeof job.depends_on === "string"
            ? JSON.parse(job.depends_on)
            : job.depends_on) as string[])
        : undefined,
      error: job.error as SerializedError | undefined,
      failParentOnFailure: job.fail_parent_on_failure === 1 || undefined,
      failedAt: job.failed_at ?? undefined,
      flowId: job.flow_id ?? undefined,
      groupKey: job.group_key ?? undefined,
      id: job.id,
      maxAttempts: job.max_attempts,
      name: job.name,
      onDependencyFailure:
        (job.on_dependency_failure as "fail" | "cancel") ?? undefined,
      parentId: job.parent_id ?? undefined,
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
}
