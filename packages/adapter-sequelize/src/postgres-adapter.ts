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
  SequelizeAdapterProps,
  SerializedError,
  StepState,
} from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"
import type { JobWhereInput } from "@vorsteh-queue/query-builder"
import { normalizeWhere } from "@vorsteh-queue/query-builder"
import type { Sequelize } from "sequelize"
import { QueryTypes } from "sequelize"

import { QueueJobModel, initQueueJobModel } from "./model"

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
 * PostgreSQL adapter using Sequelize.
 *
 * Uses Sequelize's Model pattern for CRUD operations and raw SQL for
 * critical operations requiring `FOR UPDATE SKIP LOCKED`.
 *
 * @example
 * ```typescript
 * import { Sequelize } from "sequelize"
 * import { PostgresSequelizeQueueAdapter } from "@vorsteh-queue/adapter-sequelize"
 * import { initQueueJobModel } from "@vorsteh-queue/adapter-sequelize/model"
 *
 * const sequelize = new Sequelize(process.env.DATABASE_URL)
 * initQueueJobModel(sequelize)
 *
 * const adapter = new PostgresSequelizeQueueAdapter(sequelize)
 * ```
 */
export class PostgresSequelizeQueueAdapter extends BaseQueueAdapter {
  private sequelize: Sequelize
  private readonly fullTable: string

  constructor(sequelize: Sequelize, adapterConfig?: SequelizeAdapterProps) {
    super()
    this.sequelize = sequelize

    const tableName = adapterConfig?.tableName ?? "queue_jobs"
    const schemaName = adapterConfig?.schemaName

    assertValidIdentifier(tableName, "tableName")
    if (schemaName !== undefined) {
      assertValidIdentifier(schemaName, "schemaName")
    }

    this.fullTable = schemaName
      ? `"${schemaName}"."${tableName}"`
      : `"${tableName}"`

    // Initialize the model with the sequelize instance
    initQueueJobModel(sequelize)
  }

  async connect(): Promise<void> {
    await this.sequelize.authenticate()
  }

  async disconnect(): Promise<void> {
    await this.sequelize.close()
  }

  async addJob(job: NewJob): Promise<Job> {
    const entity = await QueueJobModel.create({
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

    return PostgresSequelizeQueueAdapter.transformModel(entity)
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
    const result = await QueueJobModel.findOne({
      where: { id, queueName: this.queueName },
    })
    return result ? PostgresSequelizeQueueAdapter.transformModel(result) : null
  }

  async getNextJob(options: GetNextJobOptions): Promise<Job | null> {
    if (options.handlerNames.length === 0) {
      return null
    }

    const handlerParams: unknown[] = [this.queueName]
    const handlerInClause = buildInPlaceholders(
      options.handlerNames,
      handlerParams
    )

    // Promote delayed jobs ready to process
    const delayed = await this.sequelize.query<RawQueueJob>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'delayed' AND process_at <= NOW()
         AND name IN (${handlerInClause})
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      { bind: handlerParams, type: QueryTypes.SELECT }
    )

    if (delayed.length > 0) {
      await this.sequelize.query(
        `UPDATE ${this.fullTable} SET status = 'pending' WHERE id = $1`,
        { bind: [delayed[0]?.id], type: QueryTypes.UPDATE }
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

    const results = await this.sequelize.query<RawQueueJob>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending'
         AND name IN (${pendingHandlerInClause})
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      { bind: pendingParams, type: QueryTypes.SELECT }
    )

    const [first] = results
    return first ? PostgresSequelizeQueueAdapter.transformRawJob(first) : null
  }

  async getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    const params: unknown[] = [this.queueName, handlerName]

    let groupExclusionClause: string
    if (groupConstraints.length > 0) {
      const groupInClause = buildInPlaceholders(groupConstraints, params)
      groupExclusionClause = `AND (group_key IS NULL OR group_key NOT IN (${groupInClause}))`
    } else {
      groupExclusionClause = ""
    }

    params.push(Math.trunc(Math.max(0, count)))
    const limitParam = `$${params.length}`

    const results = await this.sequelize.query<RawQueueJob>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending' AND name = $2
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT ${limitParam} FOR UPDATE SKIP LOCKED`,
      { bind: params, type: QueryTypes.SELECT }
    )

    return results.map((row) =>
      PostgresSequelizeQueueAdapter.transformRawJob(row)
    )
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  async updateJobStatus(id: string, update: JobStatusUpdate): Promise<void> {
    const now = new Date()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = { status: update.status }

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

    await QueueJobModel.update(data, { where: { id } })
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.sequelize.query(
      `UPDATE ${this.fullTable} SET attempts = attempts + 1 WHERE id = $1`,
      { bind: [id], type: QueryTypes.UPDATE }
    )
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  async updateJobProgress(id: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, progress))
    await QueueJobModel.update({ progress: normalized }, { where: { id } })
  }

  async cancelJob(id: string, reason?: string): Promise<boolean> {
    const job = await QueueJobModel.findOne({
      where: { id, queueName: this.queueName },
    })

    if (!job) {
      return false
    }
    const cancellable = ["pending", "delayed", "processing", "failed"]
    if (!cancellable.includes(job.status)) {
      return false
    }

    await QueueJobModel.update(
      {
        cancellationReason: reason ?? null,
        cancelledAt: new Date(),
        status: "cancelled",
      },
      { where: { id } }
    )

    return true
  }

  async cancelJobs(filter: CancelJobsFilter): Promise<number> {
    const params: unknown[] = [new Date(), this.queueName]
    const conditions: string[] = [
      "queue_name = $2",
      "status IN ('pending', 'delayed', 'processing', 'failed')",
    ]

    if (filter.name) {
      params.push(filter.name)
      conditions.push(`name = $${params.length}`)
    }
    if (filter.status) {
      params.push(filter.status)
      conditions.push(`status = $${params.length}`)
    }
    if (filter.group) {
      params.push(filter.group)
      conditions.push(`group_key = $${params.length}`)
    }

    const [, affected] = await this.sequelize.query(
      `UPDATE ${this.fullTable} SET status = 'cancelled', cancelled_at = $1 WHERE ${conditions.join(" AND ")}`,
      { bind: params, type: QueryTypes.UPDATE }
    )

    return affected ?? 0
  }

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    const results = await QueueJobModel.findAll({
      where: { queueName: this.queueName, status: "dead" },
      order: [["created_at", "DESC"]],
      limit,
      offset,
    })

    return results.map((r) => PostgresSequelizeQueueAdapter.transformModel(r))
  }

  async redriveJob(id: string): Promise<void> {
    await this.sequelize.query(
      `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = $2, progress = 0, status = 'pending' WHERE id = $1`,
      { bind: [id, new Date()], type: QueryTypes.UPDATE }
    )
  }

  async redriveJobs(filter?: { name?: string }): Promise<number> {
    let query = `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = $1, progress = 0, status = 'pending' WHERE queue_name = $2 AND status = 'dead'`
    const params: unknown[] = [new Date(), this.queueName]

    if (filter?.name) {
      params.push(filter.name)
      query += ` AND name = $${params.length}`
    }

    const [, affected] = await this.sequelize.query(query, {
      bind: params,
      type: QueryTypes.UPDATE,
    })

    return affected ?? 0
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.sequelize.query<{
      status: string
      count: string
    }>(
      `SELECT status, COUNT(*) as count FROM ${this.fullTable} WHERE queue_name = $1 GROUP BY status`,
      { bind: [this.queueName], type: QueryTypes.SELECT }
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
    const normalized = normalizeWhere(where)
    const hasFilter = Object.keys(normalized).length > 0

    if (!hasFilter) {
      const pending = await QueueJobModel.count({
        where: { queueName: this.queueName, status: "pending" },
      })
      const delayed = await QueueJobModel.count({
        where: { queueName: this.queueName, status: "delayed" },
      })
      return pending + delayed
    }

    // For filtered queries, build raw SQL
    const params: unknown[] = [this.queueName]
    const conditions: string[] = ["queue_name = $1"]
    PostgresSequelizeQueueAdapter.buildWhereConditions(
      normalized,
      conditions,
      params
    )

    const result = await this.sequelize.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.fullTable} WHERE ${conditions.join(" AND ")}`,
      { bind: params, type: QueryTypes.SELECT }
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
      const results = await QueueJobModel.findAll({
        where: { queueName: this.queueName },
        order: [["created_at", "DESC"]],
        limit,
        offset,
      })
      return results.map((r) => PostgresSequelizeQueueAdapter.transformModel(r))
    }

    // For filtered queries, use raw SQL
    const params: unknown[] = [this.queueName]
    const conditions: string[] = ["queue_name = $1"]
    PostgresSequelizeQueueAdapter.buildWhereConditions(
      normalized,
      conditions,
      params
    )

    params.push(limit)
    const limitParam = `$${params.length}`
    params.push(offset)
    const offsetParam = `$${params.length}`

    const results = await this.sequelize.query<RawQueueJob>(
      `SELECT * FROM ${this.fullTable} WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
      { bind: params, type: QueryTypes.SELECT }
    )

    return results.map((row) =>
      PostgresSequelizeQueueAdapter.transformRawJob(row)
    )
  }

  async getFlows(
    options?: PaginationOptions
  ): Promise<readonly { flowId: string; rootJob: Job }[]> {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const params: unknown[] = [this.queueName]
    const results = await this.sequelize.query<RawQueueJob>(
      `SELECT * FROM ${this.fullTable} WHERE queue_name = $1 AND flow_id IS NOT NULL AND parent_id IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      { bind: [...params, limit, offset], type: QueryTypes.SELECT }
    )

    return results.map((r) => {
      const job = PostgresSequelizeQueueAdapter.transformRawJob(r)
      // oxlint-disable-next-line typescript/no-non-null-assertion
      return { flowId: job.flowId!, rootJob: job }
    })
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { queueName: this.queueName }
    if (status) {
      where.status = status
    }
    return QueueJobModel.destroy({ where })
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    // Get IDs of jobs to delete (skip the most recent `keepCount`)
    const jobsToDelete = await this.sequelize.query<{ id: string }>(
      `SELECT id FROM ${this.fullTable} WHERE queue_name = $1 AND status = $2 ORDER BY created_at DESC OFFSET $3`,
      { bind: [this.queueName, status, keepCount], type: QueryTypes.SELECT }
    )

    if (jobsToDelete.length === 0) {
      return 0
    }

    const params: unknown[] = [this.queueName]
    const idPlaceholders = buildInPlaceholders(
      jobsToDelete.map((j) => j.id),
      params
    )

    const [, affected] = await this.sequelize.query(
      `DELETE FROM ${this.fullTable} WHERE queue_name = $1 AND id IN (${idPlaceholders})`,
      { bind: params, type: QueryTypes.DELETE as unknown as QueryTypes }
    )

    return (affected as number) ?? 0
  }

  async findJobByUniqueKey(uniqueKey: string): Promise<Job | null> {
    const params: unknown[] = [this.queueName, uniqueKey]
    const results = await this.sequelize.query<RawQueueJob>(
      `SELECT * FROM ${this.fullTable} WHERE queue_name = $1 AND unique_key = $2 AND status NOT IN ('completed', 'cancelled', 'dead') LIMIT 1`,
      { bind: params, type: QueryTypes.SELECT }
    )

    const [first] = results
    return first ? PostgresSequelizeQueueAdapter.transformRawJob(first) : null
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.sequelize.transaction(async () => fn())
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    await QueueJobModel.update(
      { steps: JSON.stringify(steps) },
      { where: { id } }
    )
  }

  async retryJob(id: string): Promise<boolean> {
    const job = await QueueJobModel.findOne({
      where: { id, queueName: this.queueName, status: "failed" },
    })
    if (!job) {
      return false
    }

    await this.sequelize.query(
      `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = $2, progress = 0, status = 'pending' WHERE id = $1`,
      { bind: [id, new Date()], type: QueryTypes.UPDATE }
    )
    return true
  }

  async runJobNow(id: string): Promise<boolean> {
    const job = await QueueJobModel.findOne({
      where: { id, queueName: this.queueName, status: "delayed" },
    })
    if (!job) {
      return false
    }

    await QueueJobModel.update(
      { processAt: new Date(), status: "pending" },
      { where: { id } }
    )
    return true
  }

  // oxlint-disable-next-line eslint/class-methods-use-this
  async deleteJob(id: string): Promise<boolean> {
    const count = await QueueJobModel.destroy({ where: { id } })
    return count > 0
  }

  async setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean> {
    const job = await QueueJobModel.findOne({
      where: { id, queueName: this.queueName },
    })
    if (!job) {
      return false
    }

    const existing = (
      job.signals ? JSON.parse(job.signals as string) : {}
    ) as Record<string, unknown>
    const signals = { ...existing, [event]: data }

    await QueueJobModel.update(
      {
        processAt: new Date(),
        signals: JSON.stringify(signals),
        status: "pending",
      },
      { where: { id } }
    )
    return true
  }

  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    const jobs = await QueueJobModel.findAll({
      where: { flowId, queueName: this.queueName },
    })
    if (jobs.length === 0) {
      return null
    }

    const allJobs = jobs.map((j) =>
      PostgresSequelizeQueueAdapter.transformModel(j)
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
    const result = await this.sequelize.query(
      `DELETE FROM ${this.fullTable} WHERE queue_name = $1 AND flow_id = $2 RETURNING id`,
      { bind: [this.queueName, flowId], type: QueryTypes.SELECT }
    )
    return result.length
  }

  async incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }> {
    await this.sequelize.query(
      `UPDATE ${this.fullTable} SET children_completed = children_completed + 1 WHERE id = $1`,
      { bind: [parentId], type: QueryTypes.UPDATE }
    )
    const updated = await QueueJobModel.findOne({ where: { id: parentId } })
    return {
      completed: updated?.childrenCompleted ?? 0,
      total: updated?.childrenCount ?? 0,
    }
  }

  async getChildrenJobs(parentId: string): Promise<readonly Job[]> {
    const jobs = await QueueJobModel.findAll({
      where: { parentId, queueName: this.queueName },
    })
    return jobs.map((j) => PostgresSequelizeQueueAdapter.transformModel(j))
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private static buildWhereConditions(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: any,
    conditions: string[],
    params: unknown[]
  ): void {
    if (where.name) {
      PostgresSequelizeQueueAdapter.buildStringConditions(
        "name",
        where.name,
        conditions,
        params
      )
    }
    if (where.status) {
      PostgresSequelizeQueueAdapter.buildStringConditions(
        "status",
        where.status,
        conditions,
        params
      )
    }
    if (where.priority) {
      PostgresSequelizeQueueAdapter.buildIntConditions(
        "priority",
        where.priority,
        conditions,
        params
      )
    }
    if (where.attempts) {
      PostgresSequelizeQueueAdapter.buildIntConditions(
        "attempts",
        where.attempts,
        conditions,
        params
      )
    }
    if (where.progress) {
      PostgresSequelizeQueueAdapter.buildIntConditions(
        "progress",
        where.progress,
        conditions,
        params
      )
    }
    if (where.groupKey) {
      PostgresSequelizeQueueAdapter.buildStringConditions(
        "group_key",
        where.groupKey,
        conditions,
        params
      )
    }
    if (where.cron) {
      PostgresSequelizeQueueAdapter.buildNullConditions(
        "cron",
        where.cron,
        conditions
      )
    }
    if (where.timeout) {
      PostgresSequelizeQueueAdapter.buildNullConditions(
        "timeout",
        where.timeout,
        conditions
      )
    }
    if (where.AND) {
      for (const clause of where.AND as Record<string, unknown>[]) {
        PostgresSequelizeQueueAdapter.buildWhereConditions(
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
          PostgresSequelizeQueueAdapter.buildWhereConditions(
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
      conditions.push(`${field} = $${params.length}`)
    }
    if (filter.neq !== undefined) {
      params.push(filter.neq)
      conditions.push(`${field} != $${params.length}`)
    }
    if (filter.contains !== undefined) {
      params.push(`%${filter.contains}%`)
      conditions.push(`${field} LIKE $${params.length}`)
    }
    if (filter.startsWith !== undefined) {
      params.push(`${filter.startsWith}%`)
      conditions.push(`${field} LIKE $${params.length}`)
    }
    if (filter.like !== undefined) {
      params.push(filter.like)
      conditions.push(`${field} LIKE $${params.length}`)
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
      conditions.push(`${field} = $${params.length}`)
    }
    if (filter.neq !== undefined) {
      params.push(filter.neq)
      conditions.push(`${field} != $${params.length}`)
    }
    if (filter.lt !== undefined) {
      params.push(filter.lt)
      conditions.push(`${field} < $${params.length}`)
    }
    if (filter.lte !== undefined) {
      params.push(filter.lte)
      conditions.push(`${field} <= $${params.length}`)
    }
    if (filter.gt !== undefined) {
      params.push(filter.gt)
      conditions.push(`${field} > $${params.length}`)
    }
    if (filter.gte !== undefined) {
      params.push(filter.gte)
      conditions.push(`${field} >= $${params.length}`)
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

  private static transformModel(model: QueueJobModel): Job {
    return {
      attempts: model.attempts,
      cancellationReason: model.cancellationReason ?? undefined,
      cancelledAt: model.cancelledAt ?? undefined,
      completedAt: model.completedAt ?? undefined,
      createdAt: model.createdAt,
      cron: model.cron ?? undefined,
      dependsOn: model.dependsOn
        ? ((typeof model.dependsOn === "string"
            ? JSON.parse(model.dependsOn)
            : model.dependsOn) as string[])
        : undefined,
      error: model.error as SerializedError | undefined,
      failedAt: model.failedAt ?? undefined,
      groupKey: model.groupKey ?? undefined,
      id: model.id,
      maxAttempts: model.maxAttempts,
      name: model.name,
      onDependencyFailure:
        (model.onDependencyFailure as "fail" | "cancel") ?? undefined,
      payload:
        typeof model.payload === "string"
          ? JSON.parse(model.payload)
          : model.payload,
      priority: model.priority,
      processAt: model.processAt,
      processedAt: model.processedAt ?? undefined,
      progress: model.progress ?? 0,
      repeatCount: model.repeatCount ?? 0,
      repeatEvery: model.repeatEvery ?? undefined,
      repeatLimit: model.repeatLimit ?? undefined,
      result: model.result ?? undefined,
      status: model.status as JobStatus,
      timeout: model.timeout ?? undefined,
      uniqueKey: model.uniqueKey ?? undefined,
    }
  }

  private static transformRawJob(job: RawQueueJob): Job {
    return {
      attempts: job.attempts,
      cancellationReason: job.cancellation_reason ?? undefined,
      cancelledAt: job.cancelled_at ?? undefined,
      completedAt: job.completed_at ?? undefined,
      createdAt: job.created_at,
      cron: job.cron ?? undefined,
      dependsOn: job.depends_on
        ? ((typeof job.depends_on === "string"
            ? JSON.parse(job.depends_on)
            : job.depends_on) as string[])
        : undefined,
      error: job.error as SerializedError | undefined,
      failedAt: job.failed_at ?? undefined,
      groupKey: job.group_key ?? undefined,
      id: job.id,
      maxAttempts: job.max_attempts,
      name: job.name,
      onDependencyFailure:
        (job.on_dependency_failure as "fail" | "cancel") ?? undefined,
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
