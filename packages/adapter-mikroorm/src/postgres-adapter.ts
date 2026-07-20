import type { MikroORM } from "@mikro-orm/postgresql"
import type {
  CancelJobsFilter,
  FlowNode,
  GetNextJobOptions,
  Job,
  JobStatus,
  JobStatusUpdate,
  MikroormAdapterProps,
  NewJob,
  PaginationOptions,
  QueueStats,
  SerializedError,
  StepState,
} from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"
import type { JobWhereInput } from "@vorsteh-queue/query-builder"
import { normalizeWhere } from "@vorsteh-queue/query-builder"

import { QueueJobEntity } from "./entity"

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
 * @returns SQL fragment like `?, ?, ?`
 */
function buildInPlaceholders(
  values: readonly unknown[],
  params: unknown[]
): string {
  return values
    .map((value) => {
      params.push(value)
      return "?"
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
 * PostgreSQL adapter using MikroORM.
 *
 * Uses MikroORM's EntityManager for CRUD operations and raw SQL for
 * critical operations requiring `FOR UPDATE SKIP LOCKED`.
 *
 * @example
 * ```typescript
 * import { MikroORM } from "@mikro-orm/postgresql"
 * import { PostgresMikroormQueueAdapter } from "@vorsteh-queue/adapter-mikroorm"
 * import { QueueJobEntity, QueueJobSchema } from "@vorsteh-queue/adapter-mikroorm/entity"
 *
 * const orm = await MikroORM.init({
 *   entities: [QueueJobSchema],
 *   clientUrl: process.env.DATABASE_URL,
 * })
 *
 * const adapter = new PostgresMikroormQueueAdapter(orm)
 * ```
 */
export class PostgresMikroormQueueAdapter extends BaseQueueAdapter {
  private orm: MikroORM
  private readonly fullTable: string

  constructor(orm: MikroORM, adapterConfig?: MikroormAdapterProps) {
    super()
    this.orm = orm

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
    await this.orm.connect()
  }

  async disconnect(): Promise<void> {
    await this.orm.close()
  }

  async addJob(job: NewJob): Promise<Job> {
    const em = this.orm.em.fork()
    const entity = em.create(QueueJobEntity, {
      attempts: job.attempts,
      cancellationReason: null,
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
    })

    await em.persistAndFlush(entity)
    return PostgresMikroormQueueAdapter.transformEntity(entity)
  }

  async addJobs(jobs: readonly NewJob[]): Promise<readonly Job[]> {
    if (jobs.length === 0) {
      return []
    }

    const results: Job[] = []
    for (const job of jobs) {
      const created = await this.addJob(job)
      results.push(created)
    }
    return results
  }

  async getJobById(id: string): Promise<Job | null> {
    const em = this.orm.em.fork()
    const result = await em.findOne(QueueJobEntity, {
      id,
      queueName: this.queueName,
    })
    return result ? PostgresMikroormQueueAdapter.transformEntity(result) : null
  }

  async getNextJob(options: GetNextJobOptions): Promise<Job | null> {
    if (options.handlerNames.length === 0) {
      return null
    }

    const connection = this.orm.em.getConnection()

    const handlerParams: unknown[] = [this.queueName]
    const handlerInClause = buildInPlaceholders(
      options.handlerNames,
      handlerParams
    )

    // Promote delayed jobs ready to process
    const delayed = await connection.execute<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = ? AND status = 'delayed' AND process_at <= NOW()
         AND name IN (${handlerInClause})
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      handlerParams
    )

    if (delayed.length > 0) {
      await connection.execute(
        `UPDATE ${this.fullTable} SET status = 'pending' WHERE id = ?`,
        [delayed[0]?.id]
      )
    }

    // Pick pending jobs
    const pendingParams: unknown[] = [this.queueName]
    const pendingHandlerInClause = buildInPlaceholders(
      options.handlerNames,
      pendingParams
    )

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

    const results = await connection.execute<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = ? AND status = 'pending'
         AND name IN (${pendingHandlerInClause})
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      pendingParams
    )

    const [first] = results
    return first ? PostgresMikroormQueueAdapter.transformRawJob(first) : null
  }

  async getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    const connection = this.orm.em.getConnection()
    const params: unknown[] = [this.queueName, handlerName]

    let groupExclusionClause: string
    if (groupConstraints.length > 0) {
      const groupInClause = buildInPlaceholders(groupConstraints, params)
      groupExclusionClause = `AND (group_key IS NULL OR group_key NOT IN (${groupInClause}))`
    } else {
      groupExclusionClause = ""
    }

    params.push(Math.trunc(Math.max(0, count)))
    const limitParam = "?"

    const results = await connection.execute<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = ? AND status = 'pending' AND name = ?
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT ${limitParam} FOR UPDATE SKIP LOCKED`,
      params
    )

    return results.map((row) =>
      PostgresMikroormQueueAdapter.transformRawJob(row)
    )
  }

  async updateJobStatus(id: string, update: JobStatusUpdate): Promise<void> {
    const em = this.orm.em.fork()
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

    await em.nativeUpdate(QueueJobEntity, { id }, data)
  }

  async incrementJobAttempts(id: string): Promise<void> {
    const connection = this.orm.em.getConnection()
    await connection.execute(
      `UPDATE ${this.fullTable} SET attempts = attempts + 1 WHERE id = ?`,
      [id]
    )
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const em = this.orm.em.fork()
    const normalized = Math.max(0, Math.min(100, progress))
    await em.nativeUpdate(QueueJobEntity, { id }, { progress: normalized })
  }

  async cancelJob(id: string, reason?: string): Promise<boolean> {
    const em = this.orm.em.fork()
    const job = await em.findOne(QueueJobEntity, {
      id,
      queueName: this.queueName,
    })

    if (!job) {
      return false
    }
    const cancellable = ["pending", "delayed", "processing", "failed"]
    if (!cancellable.includes(job.status)) {
      return false
    }

    await em.nativeUpdate(
      QueueJobEntity,
      { id },
      {
        cancellationReason: reason ?? null,
        cancelledAt: new Date(),
        status: "cancelled",
      }
    )

    return true
  }

  async cancelJobs(filter: CancelJobsFilter): Promise<number> {
    const em = this.orm.em.fork()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      queueName: this.queueName,
      status: { $in: ["pending", "delayed", "processing", "failed"] },
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

    return em.nativeUpdate(QueueJobEntity, where, {
      cancelledAt: new Date(),
      status: "cancelled",
    })
  }

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const em = this.orm.em.fork()
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    const results = await em.find(
      QueueJobEntity,
      { queueName: this.queueName, status: "dead" },
      { orderBy: { createdAt: "DESC" }, limit, offset }
    )

    return results.map((r) => PostgresMikroormQueueAdapter.transformEntity(r))
  }

  async redriveJob(id: string): Promise<void> {
    const connection = this.orm.em.getConnection()
    await connection.execute(
      `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = ?, progress = 0, status = 'pending' WHERE id = ?`,
      [new Date(), id]
    )
  }

  async redriveJobs(filter?: { name?: string }): Promise<number> {
    const em = this.orm.em.fork()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      queueName: this.queueName,
      status: "dead",
    }
    if (filter?.name) {
      where.name = filter.name
    }

    return em.nativeUpdate(QueueJobEntity, where, {
      attempts: 0,
      error: null,
      failedAt: null,
      processAt: new Date(),
      progress: 0,
      status: "pending",
    })
  }

  async getQueueStats(): Promise<QueueStats> {
    const connection = this.orm.em.getConnection()
    const stats = await connection.execute<{ status: string; count: string }[]>(
      `SELECT status, COUNT(*) as count FROM ${this.fullTable} WHERE queue_name = ? GROUP BY status`,
      [this.queueName]
    )

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
      if (stat.status in result) {
        result[stat.status as keyof typeof result] = Number(stat.count)
      }
    }
    return result
  }

  async size(where?: JobWhereInput): Promise<number> {
    const em = this.orm.em.fork()
    const normalized = normalizeWhere(where)
    const hasFilter = Object.keys(normalized).length > 0

    if (!hasFilter) {
      const pending = await em.count(QueueJobEntity, {
        queueName: this.queueName,
        status: "pending",
      })
      const delayed = await em.count(QueueJobEntity, {
        queueName: this.queueName,
        status: "delayed",
      })
      return pending + delayed
    }

    // For filtered queries, build raw SQL
    const connection = this.orm.em.getConnection()
    const params: unknown[] = [this.queueName]
    const conditions: string[] = ["queue_name = ?"]
    PostgresMikroormQueueAdapter.buildWhereConditions(
      normalized,
      conditions,
      params
    )

    const result = await connection.execute<{ count: string }[]>(
      `SELECT COUNT(*) as count FROM ${this.fullTable} WHERE ${conditions.join(" AND ")}`,
      params
    )

    return Number(result[0]?.count ?? 0)
  }

  async getJobs(options: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const normalized = normalizeWhere(options.where)
    const hasFilter = Object.keys(normalized).length > 0

    if (!hasFilter) {
      const em = this.orm.em.fork()
      const results = await em.find(
        QueueJobEntity,
        { queueName: this.queueName },
        { orderBy: { createdAt: "DESC" }, limit, offset }
      )
      return results.map((r) => PostgresMikroormQueueAdapter.transformEntity(r))
    }

    // For filtered queries, use raw SQL
    const connection = this.orm.em.getConnection()
    const params: unknown[] = [this.queueName]
    const conditions: string[] = ["queue_name = ?"]
    PostgresMikroormQueueAdapter.buildWhereConditions(
      normalized,
      conditions,
      params
    )

    params.push(limit)
    const limitParam = "?"
    params.push(offset)
    const offsetParam = "?"

    const results = await connection.execute<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable} WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params
    )

    return results.map((row) =>
      PostgresMikroormQueueAdapter.transformRawJob(row)
    )
  }

  async getFlows(
    options?: PaginationOptions
  ): Promise<readonly { flowId: string; rootJob: Job }[]> {
    const em = this.orm.em.fork()
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const rows = await em.find(
      QueueJobEntity,
      {
        queueName: this.queueName,
        flowId: { $ne: null },
        parentId: null,
      },
      { orderBy: { createdAt: "DESC" }, limit, offset }
    )

    return rows.map((r) => {
      const job = PostgresMikroormQueueAdapter.transformEntity(r)
      // oxlint-disable-next-line typescript/no-non-null-assertion
      return { flowId: job.flowId!, rootJob: job }
    })
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const em = this.orm.em.fork()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { queueName: this.queueName }
    if (status) {
      filter.status = status
    }
    return em.nativeDelete(QueueJobEntity, filter)
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    const connection = this.orm.em.getConnection()

    // Get IDs of jobs to delete (skip the most recent `keepCount`)
    const jobsToDelete = await connection.execute<{ id: string }[]>(
      `SELECT id FROM ${this.fullTable} WHERE queue_name = ? AND status = ? ORDER BY created_at DESC OFFSET ?`,
      [this.queueName, status, keepCount]
    )

    if (jobsToDelete.length === 0) {
      return 0
    }

    const params: unknown[] = [this.queueName]
    const idPlaceholders = buildInPlaceholders(
      jobsToDelete.map((j) => j.id),
      params
    )

    const result = await connection.execute(
      `DELETE FROM ${this.fullTable} WHERE queue_name = ? AND id IN (${idPlaceholders})`,
      params
    )

    return typeof result === "number"
      ? result
      : ((result as { affectedRows?: number }).affectedRows ?? 0)
  }

  async findJobByUniqueKey(uniqueKey: string): Promise<Job | null> {
    const em = this.orm.em.fork()
    const result = await em.findOne(QueueJobEntity, {
      queueName: this.queueName,
      uniqueKey,
      status: { $nin: ["completed", "cancelled", "dead"] },
    })

    return result ? PostgresMikroormQueueAdapter.transformEntity(result) : null
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.orm.em.fork().transactional(async () => fn())
  }

  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    const em = this.orm.em.fork()
    await em.nativeUpdate(
      QueueJobEntity,
      { id },
      { steps: JSON.stringify(steps) }
    )
  }

  async retryJob(id: string): Promise<boolean> {
    const em = this.orm.em.fork()
    const job = await em.findOne(QueueJobEntity, {
      id,
      queueName: this.queueName,
      status: "failed",
    })
    if (!job) {
      return false
    }

    const connection = this.orm.em.getConnection()
    await connection.execute(
      `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = ?, progress = 0, status = 'pending' WHERE id = ?`,
      [new Date(), id]
    )
    return true
  }

  async runJobNow(id: string): Promise<boolean> {
    const em = this.orm.em.fork()
    const job = await em.findOne(QueueJobEntity, {
      id,
      queueName: this.queueName,
      status: "delayed",
    })
    if (!job) {
      return false
    }

    await em.nativeUpdate(
      QueueJobEntity,
      { id },
      { processAt: new Date(), status: "pending" }
    )
    return true
  }

  async deleteJob(id: string): Promise<boolean> {
    const em = this.orm.em.fork()
    const count = await em.nativeDelete(QueueJobEntity, { id })
    return count > 0
  }

  async setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean> {
    const em = this.orm.em.fork()
    const job = await em.findOne(QueueJobEntity, {
      id,
      queueName: this.queueName,
    })
    if (!job) {
      return false
    }

    const existing = (
      job.signals ? JSON.parse(job.signals as string) : {}
    ) as Record<string, unknown>
    const signals = { ...existing, [event]: data }

    await em.nativeUpdate(
      QueueJobEntity,
      { id },
      {
        processAt: new Date(),
        signals: JSON.stringify(signals),
        status: "pending",
      }
    )
    return true
  }

  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    const em = this.orm.em.fork()
    // oxlint-disable-next-line unicorn/no-array-method-this-argument
    const jobs = await em.find(QueueJobEntity, {
      flowId,
      queueName: this.queueName,
    })
    if (jobs.length === 0) {
      return null
    }

    const allJobs = jobs.map((j) =>
      PostgresMikroormQueueAdapter.transformEntity(j)
    )
    const root = allJobs.find((j) => !j.parentId)
    if (!root) {
      return null
    }

    const buildNode = (job: Job): FlowNode => {
      const children = allJobs.filter((j) => j.parentId === job.id)
      return { children: children.map((c) => buildNode(c)), job }
    }
    return buildNode(root)
  }

  async deleteFlow(flowId: string): Promise<number> {
    const connection = this.orm.em.getConnection()
    const result = await connection.execute<{ id: string }[]>(
      `DELETE FROM ${this.fullTable} WHERE queue_name = ? AND flow_id = ? RETURNING id`,
      [this.queueName, flowId]
    )
    return result.length
  }

  async incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }> {
    const connection = this.orm.em.getConnection()
    await connection.execute(
      `UPDATE ${this.fullTable} SET children_completed = children_completed + 1 WHERE id = ?`,
      [parentId]
    )
    const em = this.orm.em.fork()
    const updated = await em.findOne(QueueJobEntity, { id: parentId })
    return {
      completed: updated?.childrenCompleted ?? 0,
      total: updated?.childrenCount ?? 0,
    }
  }

  async getChildrenJobs(parentId: string): Promise<readonly Job[]> {
    const em = this.orm.em.fork()
    // oxlint-disable-next-line unicorn/no-array-method-this-argument
    const jobs = await em.find(QueueJobEntity, {
      parentId,
      queueName: this.queueName,
    })
    return jobs.map((j) => PostgresMikroormQueueAdapter.transformEntity(j))
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private static buildWhereConditions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: any,
    conditions: string[],
    params: unknown[]
  ): void {
    if (where.name) {
      PostgresMikroormQueueAdapter.buildStringConditions(
        "name",
        where.name,
        conditions,
        params
      )
    }
    if (where.status) {
      PostgresMikroormQueueAdapter.buildStringConditions(
        "status",
        where.status,
        conditions,
        params
      )
    }
    if (where.priority) {
      PostgresMikroormQueueAdapter.buildIntConditions(
        "priority",
        where.priority,
        conditions,
        params
      )
    }
    if (where.attempts) {
      PostgresMikroormQueueAdapter.buildIntConditions(
        "attempts",
        where.attempts,
        conditions,
        params
      )
    }
    if (where.progress) {
      PostgresMikroormQueueAdapter.buildIntConditions(
        "progress",
        where.progress,
        conditions,
        params
      )
    }
    if (where.groupKey) {
      PostgresMikroormQueueAdapter.buildStringConditions(
        "group_key",
        where.groupKey,
        conditions,
        params
      )
    }
    if (where.cron) {
      PostgresMikroormQueueAdapter.buildNullConditions(
        "cron",
        where.cron,
        conditions
      )
    }
    if (where.timeout) {
      PostgresMikroormQueueAdapter.buildNullConditions(
        "timeout",
        where.timeout,
        conditions
      )
    }
    if (where.AND) {
      for (const clause of where.AND as Record<string, unknown>[]) {
        PostgresMikroormQueueAdapter.buildWhereConditions(
          clause,
          conditions,
          params
        )
      }
    }
    if (where.OR) {
      const orClauses = where.OR as Record<string, unknown>[]
      if (orClauses.length > 0) {
        const orParts: string[] = []
        for (const clause of orClauses) {
          const subConditions: string[] = []
          PostgresMikroormQueueAdapter.buildWhereConditions(
            clause,
            subConditions,
            params
          )
          if (subConditions.length > 0) {
            orParts.push(`(${subConditions.join(" AND ")})`)
          }
        }
        if (orParts.length > 0) {
          conditions.push(`(${orParts.join(" OR ")})`)
        }
      }
    }
  }

  private static buildStringConditions(
    field: string,
    filter: Record<string, unknown>,
    conditions: string[],
    params: unknown[]
  ): void {
    if (filter.eq !== undefined) {
      params.push(filter.eq)
      conditions.push(`${field} = ?`)
    }
    if (filter.neq !== undefined) {
      params.push(filter.neq)
      conditions.push(`${field} != ?`)
    }
    if (filter.contains !== undefined) {
      params.push(`%${filter.contains}%`)
      conditions.push(`${field} LIKE ?`)
    }
    if (filter.startsWith !== undefined) {
      params.push(`${filter.startsWith}%`)
      conditions.push(`${field} LIKE ?`)
    }
    if (filter.like !== undefined) {
      params.push(filter.like)
      conditions.push(`${field} LIKE ?`)
    }
    if (filter.in !== undefined) {
      const inClause = buildInPlaceholders(filter.in as unknown[], params)
      conditions.push(`${field} IN (${inClause})`)
    }
    if (filter.isNull === true) {
      conditions.push(`${field} IS NULL`)
    }
    if (filter.isNull === false) {
      conditions.push(`${field} IS NOT NULL`)
    }
  }

  private static buildIntConditions(
    field: string,
    filter: Record<string, unknown>,
    conditions: string[],
    params: unknown[]
  ): void {
    if (filter.eq !== undefined) {
      params.push(filter.eq)
      conditions.push(`${field} = ?`)
    }
    if (filter.neq !== undefined) {
      params.push(filter.neq)
      conditions.push(`${field} != ?`)
    }
    if (filter.lt !== undefined) {
      params.push(filter.lt)
      conditions.push(`${field} < ?`)
    }
    if (filter.lte !== undefined) {
      params.push(filter.lte)
      conditions.push(`${field} <= ?`)
    }
    if (filter.gt !== undefined) {
      params.push(filter.gt)
      conditions.push(`${field} > ?`)
    }
    if (filter.gte !== undefined) {
      params.push(filter.gte)
      conditions.push(`${field} >= ?`)
    }
  }

  private static buildNullConditions(
    field: string,
    filter: Record<string, unknown>,
    conditions: string[]
  ): void {
    if (filter.isNull === true) {
      conditions.push(`${field} IS NULL`)
    }
    if (filter.isNull === false) {
      conditions.push(`${field} IS NOT NULL`)
    }
  }

  // ─── Transform helpers ───────────────────────────────────────────────────────

  // oxlint-disable-next-line complexity
  private static transformEntity(entity: QueueJobEntity): Job {
    return {
      attempts: entity.attempts,
      cancellationReason: entity.cancellationReason ?? undefined,
      cancelledAt: entity.cancelledAt ?? undefined,
      childrenCompleted: entity.childrenCompleted ?? 0,
      childrenCount: entity.childrenCount ?? 0,
      completedAt: entity.completedAt ?? undefined,
      // oxlint-disable-next-line typescript/no-non-null-assertion
      createdAt: entity.createdAt!,
      cron: entity.cron ?? undefined,
      dependsOn: entity.dependsOn
        ? ((typeof entity.dependsOn === "string"
            ? JSON.parse(entity.dependsOn)
            : entity.dependsOn) as string[])
        : undefined,
      error: entity.error as SerializedError | undefined,
      failParentOnFailure: entity.failParentOnFailure === 1 || undefined,
      failedAt: entity.failedAt ?? undefined,
      flowId: entity.flowId ?? undefined,
      groupKey: entity.groupKey ?? undefined,
      // oxlint-disable-next-line typescript/no-non-null-assertion
      id: entity.id!,
      maxAttempts: entity.maxAttempts,
      name: entity.name,
      onDependencyFailure:
        (entity.onDependencyFailure as "fail" | "cancel") ?? undefined,
      parentId: entity.parentId ?? undefined,
      payload:
        typeof entity.payload === "string"
          ? JSON.parse(entity.payload)
          : entity.payload,
      priority: entity.priority,
      processAt: entity.processAt,
      processedAt: entity.processedAt ?? undefined,
      progress: entity.progress ?? 0,
      repeatCount: entity.repeatCount ?? 0,
      repeatEvery: entity.repeatEvery ?? undefined,
      repeatLimit: entity.repeatLimit ?? undefined,
      result: entity.result ?? undefined,
      status: entity.status as JobStatus,
      timeout: entity.timeout ?? undefined,
      uniqueKey: entity.uniqueKey ?? undefined,
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
