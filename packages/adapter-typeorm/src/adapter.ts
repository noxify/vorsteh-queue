import type {
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
  TypeormAdapterProps,
} from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"
import type { JobWhereInput } from "@vorsteh-queue/query-builder"
import { normalizeWhere } from "@vorsteh-queue/query-builder"
import type { DataSource, EntityManager, Repository } from "typeorm"

import { QueueFlowEntity } from "./flow-entity"
import { QueueJobEntity } from "./queue-entity"

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
 * PostgreSQL adapter using TypeORM.
 *
 * Uses TypeORM's DataSource and Repository pattern with raw SQL for
 * critical operations requiring `FOR UPDATE SKIP LOCKED`.
 *
 * @example
 * ```typescript
 * import { DataSource } from "typeorm"
 * import { PostgresTypeormQueueAdapter } from "@vorsteh-queue/adapter-typeorm"
 * import { QueueJobEntity } from "@vorsteh-queue/adapter-typeorm/entity"
 *
 * const dataSource = new DataSource({
 *   type: "postgres",
 *   url: process.env.DATABASE_URL,
 *   entities: [QueueJobEntity],
 *   synchronize: true,
 * })
 *
 * const adapter = new PostgresTypeormQueueAdapter(dataSource)
 * ```
 */
export class PostgresTypeormQueueAdapter
  extends BaseQueueAdapter
  implements FlowAdapter
{
  private dataSource: DataSource
  private repo!: Repository<QueueJobEntity>
  private flowRepo!: Repository<QueueFlowEntity>
  private readonly fullTable: string
  private readonly fullFlowTable: string

  constructor(dataSource: DataSource, adapterConfig?: TypeormAdapterProps) {
    super()
    this.dataSource = dataSource

    const tableName = adapterConfig?.tableName ?? "queue_jobs"
    const schemaName = adapterConfig?.schemaName
    const flowTableName = adapterConfig?.flowTableName ?? "queue_flows"

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
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize()
    }
    this.repo = this.dataSource.getRepository(QueueJobEntity)
    this.flowRepo = this.dataSource.getRepository(QueueFlowEntity)
  }

  async disconnect(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy()
    }
  }

  async addJob(job: NewJob): Promise<Job> {
    const entity = this.repo.create({
      attempts: job.attempts,
      cancellationReason: null,
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
    })

    const saved = await this.repo.save(entity)
    return PostgresTypeormQueueAdapter.transformEntity(saved)
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
    const result = await this.repo.findOne({
      where: { id, queueName: this.queueName },
    })
    return result ? PostgresTypeormQueueAdapter.transformEntity(result) : null
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
    const delayed = await this.dataSource.query<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'delayed' AND process_at <= NOW()
         AND name IN (${handlerInClause})
         AND attempts < max_attempts
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      handlerParams
    )

    if (delayed.length > 0) {
      await this.dataSource.query(
        `UPDATE ${this.fullTable} SET status = 'pending' WHERE id = $1`,
        [delayed[0]?.id]
      )
    }

    // Move exhausted delayed jobs to dead (safety net)
    await this.dataSource.query(
      `UPDATE ${this.fullTable} SET status = 'dead'
       WHERE queue_name = $1 AND status = 'delayed' AND process_at <= NOW()
         AND attempts >= max_attempts`,
      [this.queueName]
    )

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

    const results = await this.dataSource.query<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending'
         AND name IN (${pendingHandlerInClause})
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT 1 FOR UPDATE SKIP LOCKED`,
      pendingParams
    )

    const [first] = results
    return first ? PostgresTypeormQueueAdapter.transformRawJob(first) : null
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

    const results = await this.dataSource.query<RawQueueJob[]>(
      `SELECT * FROM ${this.fullTable}
       WHERE queue_name = $1 AND status = 'pending' AND name = $2
         ${groupExclusionClause}
       ORDER BY priority ASC, created_at ASC
       LIMIT ${limitParam} FOR UPDATE SKIP LOCKED`,
      params
    )

    return results.map((row) =>
      PostgresTypeormQueueAdapter.transformRawJob(row)
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

    await this.repo.update(id, data)
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.repo.increment({ id }, "attempts", 1)
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, progress))
    await this.repo.update(id, { progress: normalized })
  }

  async cancelJob(id: string, reason?: string): Promise<boolean> {
    const job = await this.repo.findOne({
      where: { id, queueName: this.queueName },
    })

    if (!job) {
      return false
    }
    const cancellable = ["pending", "delayed", "processing", "failed"]
    if (!cancellable.includes(job.status)) {
      return false
    }

    await this.repo.update(id, {
      cancellationReason: reason ?? null,
      cancelledAt: new Date(),
      status: "cancelled",
    })

    return true
  }

  async cancelJobs(filter: CancelJobsFilter): Promise<number> {
    const qb = this.repo
      .createQueryBuilder()
      .update()
      .set({ cancelledAt: new Date(), status: "cancelled" })
      .where("queueName = :queueName", { queueName: this.queueName })
      .andWhere("status IN (:...statuses)", {
        statuses: ["pending", "delayed", "processing", "failed"],
      })

    if (filter.name) {
      qb.andWhere("name = :name", { name: filter.name })
    }
    if (filter.status) {
      qb.andWhere("status = :filterStatus", { filterStatus: filter.status })
    }
    if (filter.group) {
      qb.andWhere("groupKey = :group", { group: filter.group })
    }

    const result = await qb.execute()
    return result.affected ?? 0
  }

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    const results = await this.repo.find({
      order: { createdAt: "DESC" },
      skip: offset,
      take: limit,
      where: { queueName: this.queueName, status: "dead" },
    })

    return results.map((r) => PostgresTypeormQueueAdapter.transformEntity(r))
  }

  async redriveJob(id: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = $2, progress = 0, status = 'pending' WHERE id = $1`,
      [id, new Date()]
    )
  }

  async redriveJobs(filter?: { name?: string }): Promise<number> {
    let query = `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = $1, progress = 0, status = 'pending' WHERE queue_name = $2 AND status = 'dead'`
    const params: unknown[] = [new Date(), this.queueName]

    if (filter?.name) {
      params.push(filter.name)
      query += ` AND name = $${params.length}`
    }

    const result = await this.dataSource.query(query, params)
    return result?.[1] ?? 0
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.repo
      .createQueryBuilder("job")
      .select("job.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("job.queueName = :queueName", { queueName: this.queueName })
      .groupBy("job.status")
      .getRawMany<{ status: string; count: string }>()

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
      return this.repo.count({
        where: [
          { queueName: this.queueName, status: "pending" },
          { queueName: this.queueName, status: "delayed" },
        ],
      })
    }

    // For filtered queries, build raw SQL since TypeORM's FindOperator
    // approach is complex with AND/OR
    const qb = this.repo
      .createQueryBuilder("job")
      .where("job.queueName = :queueName", { queueName: this.queueName })

    this.applyNormalizedWhere(qb, normalized)
    return qb.getCount()
  }

  async getJobs(options: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const normalized = normalizeWhere(options.where)

    const qb = this.repo
      .createQueryBuilder("job")
      .where("job.queueName = :queueName", { queueName: this.queueName })
      .orderBy("job.createdAt", "DESC")
      .take(limit)
      .skip(offset)

    this.applyNormalizedWhere(qb, normalized)

    const rows = await qb.getMany()
    return rows.map((r) => PostgresTypeormQueueAdapter.transformEntity(r))
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const qb = this.repo
      .createQueryBuilder()
      .delete()
      .where("queueName = :queueName", { queueName: this.queueName })

    if (status) {
      qb.andWhere("status = :status", { status })
    }

    const result = await qb.execute()
    return result.affected ?? 0
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    const jobsToDelete = await this.repo
      .createQueryBuilder("job")
      .select("job.id")
      .where("job.queueName = :queueName", { queueName: this.queueName })
      .andWhere("job.status = :status", { status })
      .orderBy("job.createdAt", "DESC")
      .skip(keepCount)
      .getMany()

    if (jobsToDelete.length === 0) {
      return 0
    }

    const ids = jobsToDelete.map((j) => j.id)
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .whereInIds(ids)
      .execute()

    return result.affected ?? 0
  }

  async findJobByUniqueKey(uniqueKey: string): Promise<Job | null> {
    const result = await this.repo
      .createQueryBuilder("job")
      .where("job.queueName = :queueName", { queueName: this.queueName })
      .andWhere("job.uniqueKey = :uniqueKey", { uniqueKey })
      .andWhere("job.status NOT IN (:...statuses)", {
        statuses: ["completed", "cancelled", "dead"],
      })
      .getOne()

    return result ? PostgresTypeormQueueAdapter.transformEntity(result) : null
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.dataSource.transaction(async () => fn())
  }

  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    await this.repo.update(id, { steps: JSON.stringify(steps) })
  }

  async retryJob(id: string): Promise<boolean> {
    const job = await this.repo.findOne({
      where: { id, queueName: this.queueName, status: "failed" },
    })
    if (!job) {
      return false
    }

    await this.dataSource.query(
      `UPDATE ${this.fullTable} SET attempts = 0, error = NULL, failed_at = NULL, process_at = $2, progress = 0, status = 'pending' WHERE id = $1`,
      [id, new Date()]
    )
    return true
  }

  async runJobNow(id: string): Promise<boolean> {
    const job = await this.repo.findOne({
      where: { id, queueName: this.queueName, status: "delayed" },
    })
    if (!job) {
      return false
    }

    await this.repo.update(id, { processAt: new Date(), status: "pending" })
    return true
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await this.repo.delete(id)
    return (result.affected ?? 0) > 0
  }

  async setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean> {
    const job = await this.repo.findOne({
      where: { id, queueName: this.queueName },
    })
    if (!job) {
      return false
    }

    const existing = (
      job.signals ? JSON.parse(job.signals as string) : {}
    ) as Record<string, unknown>
    const signals = { ...existing, [event]: data }

    await this.repo.update(id, {
      processAt: new Date(),
      signals: JSON.stringify(signals),
      status: "pending",
    })
    return true
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyNormalizedWhere(qb: any, where: any): void {
    if (where.name) {
      PostgresTypeormQueueAdapter.applyStringFilter(
        qb,
        "job.name",
        where.name as Record<string, unknown>
      )
    }
    if (where.status) {
      PostgresTypeormQueueAdapter.applyStatusFilter(
        qb,
        where.status as Record<string, unknown>
      )
    }
    if (where.priority) {
      PostgresTypeormQueueAdapter.applyIntFilter(
        qb,
        "job.priority",
        where.priority as Record<string, unknown>
      )
    }
    if (where.attempts) {
      PostgresTypeormQueueAdapter.applyIntFilter(
        qb,
        "job.attempts",
        where.attempts as Record<string, unknown>
      )
    }
    if (where.progress) {
      PostgresTypeormQueueAdapter.applyIntFilter(
        qb,
        "job.progress",
        where.progress as Record<string, unknown>
      )
    }
    if (where.groupKey) {
      PostgresTypeormQueueAdapter.applyStringFilter(
        qb,
        "job.groupKey",
        where.groupKey as Record<string, unknown>
      )
    }
    if (where.cron) {
      PostgresTypeormQueueAdapter.applyNullFilter(qb, "job.cron", where.cron)
    }
    if (where.timeout) {
      PostgresTypeormQueueAdapter.applyNullFilter(
        qb,
        "job.timeout",
        where.timeout
      )
    }
    if (where.AND) {
      for (const clause of where.AND as Record<string, unknown>[]) {
        this.applyNormalizedWhere(qb, clause)
      }
    }
    if (where.OR) {
      const orClauses = where.OR as Record<string, unknown>[]
      if (orClauses.length > 0) {
        // Build OR as a sub-expression
        const conditions: string[] = []
        const params: Record<string, unknown> = {}
        for (const [i, clause] of orClauses.entries()) {
          const subConditions =
            PostgresTypeormQueueAdapter.buildConditionStrings(clause, `or${i}`)
          conditions.push(`(${subConditions.conditions.join(" AND ")})`)
          Object.assign(params, subConditions.params)
        }
        if (conditions.length > 0) {
          qb.andWhere(`(${conditions.join(" OR ")})`, params)
        }
      }
    }
  }

  private static applyStringFilter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qb: any,
    field: string,
    filter: Record<string, unknown>
  ): void {
    const paramKey = field.replace(".", "_")
    if (filter.eq !== undefined) {
      qb.andWhere(`${field} = :${paramKey}_eq`, {
        [`${paramKey}_eq`]: filter.eq,
      })
    }
    if (filter.neq !== undefined) {
      qb.andWhere(`${field} != :${paramKey}_neq`, {
        [`${paramKey}_neq`]: filter.neq,
      })
    }
    if (filter.contains !== undefined) {
      qb.andWhere(`${field} LIKE :${paramKey}_like`, {
        [`${paramKey}_like`]: `%${filter.contains}%`,
      })
    }
    if (filter.startsWith !== undefined) {
      qb.andWhere(`${field} LIKE :${paramKey}_sw`, {
        [`${paramKey}_sw`]: `${filter.startsWith}%`,
      })
    }
    if (filter.like !== undefined) {
      qb.andWhere(`${field} LIKE :${paramKey}_lk`, {
        [`${paramKey}_lk`]: filter.like,
      })
    }
    if (filter.in !== undefined) {
      qb.andWhere(`${field} IN (:...${paramKey}_in)`, {
        [`${paramKey}_in`]: filter.in,
      })
    }
    if (filter.isNull === true) {
      qb.andWhere(`${field} IS NULL`)
    }
    if (filter.isNull === false) {
      qb.andWhere(`${field} IS NOT NULL`)
    }
  }

  private static applyStatusFilter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qb: any,
    filter: Record<string, unknown>
  ): void {
    if (filter.eq !== undefined) {
      qb.andWhere("job.status = :status_eq", { status_eq: filter.eq })
    }
    if (filter.neq !== undefined) {
      qb.andWhere("job.status != :status_neq", { status_neq: filter.neq })
    }
    if (filter.in !== undefined) {
      qb.andWhere("job.status IN (:...status_in)", { status_in: filter.in })
    }
  }

  private static applyIntFilter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qb: any,
    field: string,
    filter: Record<string, unknown>
  ): void {
    const paramKey = field.replace(".", "_")
    if (filter.eq !== undefined) {
      qb.andWhere(`${field} = :${paramKey}_eq`, {
        [`${paramKey}_eq`]: filter.eq,
      })
    }
    if (filter.neq !== undefined) {
      qb.andWhere(`${field} != :${paramKey}_neq`, {
        [`${paramKey}_neq`]: filter.neq,
      })
    }
    if (filter.lt !== undefined) {
      qb.andWhere(`${field} < :${paramKey}_lt`, {
        [`${paramKey}_lt`]: filter.lt,
      })
    }
    if (filter.lte !== undefined) {
      qb.andWhere(`${field} <= :${paramKey}_lte`, {
        [`${paramKey}_lte`]: filter.lte,
      })
    }
    if (filter.gt !== undefined) {
      qb.andWhere(`${field} > :${paramKey}_gt`, {
        [`${paramKey}_gt`]: filter.gt,
      })
    }
    if (filter.gte !== undefined) {
      qb.andWhere(`${field} >= :${paramKey}_gte`, {
        [`${paramKey}_gte`]: filter.gte,
      })
    }
  }

  private static applyNullFilter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qb: any,
    field: string,
    filter: Record<string, unknown>
  ): void {
    if (filter.isNull === true) {
      qb.andWhere(`${field} IS NULL`)
    }
    if (filter.isNull === false) {
      qb.andWhere(`${field} IS NOT NULL`)
    }
  }

  private static buildConditionStrings(
    clause: Record<string, unknown>,
    prefix: string
  ): { conditions: string[]; params: Record<string, unknown> } {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (clause.name) {
      const f = clause.name as Record<string, unknown>
      if (f.eq !== undefined) {
        conditions.push(`job.name = :${prefix}_name`)
        params[`${prefix}_name`] = f.eq
      }
      if (f.contains !== undefined) {
        conditions.push(`job.name LIKE :${prefix}_name_like`)
        params[`${prefix}_name_like`] = `%${f.contains}%`
      }
    }
    if (clause.status) {
      const f = clause.status as Record<string, unknown>
      if (f.eq !== undefined) {
        conditions.push(`job.status = :${prefix}_status`)
        params[`${prefix}_status`] = f.eq
      }
      if (f.in !== undefined) {
        conditions.push(`job.status IN (:...${prefix}_status_in)`)
        params[`${prefix}_status_in`] = f.in
      }
    }
    if (clause.priority) {
      const f = clause.priority as Record<string, unknown>
      if (f.lte !== undefined) {
        conditions.push(`job.priority <= :${prefix}_priority_lte`)
        params[`${prefix}_priority_lte`] = f.lte
      }
      if (f.gte !== undefined) {
        conditions.push(`job.priority >= :${prefix}_priority_gte`)
        params[`${prefix}_priority_gte`] = f.gte
      }
    }

    if (conditions.length === 0) {
      conditions.push("1=1")
    }

    return { conditions, params }
  }

  // ─── Transform helpers ───────────────────────────────────────────────────────

  // oxlint-disable-next-line complexity
  private static transformEntity(entity: QueueJobEntity): Job {
    return {
      attempts: entity.attempts,
      cancellationReason: entity.cancellationReason ?? undefined,
      cancelledAt: entity.cancelledAt ?? undefined,
      completedAt: entity.completedAt ?? undefined,
      createdAt: entity.createdAt,
      cron: entity.cron ?? undefined,
      error: entity.error as SerializedError | undefined,
      failedAt: entity.failedAt ?? undefined,
      flowNodeId: entity.flowNodeId ?? undefined,
      groupKey: entity.groupKey ?? undefined,
      id: entity.id,
      maxAttempts: entity.maxAttempts,
      name: entity.name,
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

  private static transformFlowEntity(entity: QueueFlowEntity): FlowNode {
    return {
      id: entity.id,
      flowId: entity.flowId,
      parentNodeId: entity.parentNodeId ?? undefined,
      jobId: entity.jobId ?? undefined,
      queueName: entity.queueName,
      name: entity.name,
      payload: entity.payload,
      options: entity.options as FlowNode["options"],
      status: entity.status as FlowNode["status"],
      failureStrategy: entity.failureStrategy as FlowNode["failureStrategy"],
      childrenCount: entity.childrenCount,
      childrenCompleted: entity.childrenCompleted,
      result: entity.result ?? undefined,
      error: entity.error as SerializedError | undefined,
      createdAt: entity.createdAt,
      completedAt: entity.completedAt ?? undefined,
    }
  }

  // ─── FlowAdapter Implementation ──────────────────────────────────────────

  async createFlow(
    nodes: readonly NewFlowNode[],
    leafJobs: readonly NewJob[]
  ): Promise<readonly FlowNode[]> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const flowRepo = manager.getRepository(QueueFlowEntity)
      const jobRepo = manager.getRepository(QueueJobEntity)

      // Insert all flow nodes with pre-generated IDs
      const flowEntities = nodes.map((n) =>
        flowRepo.create({
          id: n.id,
          flowId: n.flowId,
          parentNodeId: n.parentNodeId ?? null,
          jobId: n.jobId ?? null,
          queueName: n.queueName,
          name: n.name,
          payload: n.payload,
          options: n.options ?? null,
          status: n.status,
          failureStrategy: n.failureStrategy,
          childrenCount: n.childrenCount,
          childrenCompleted: n.childrenCompleted,
        })
      )
      await flowRepo.save(flowEntities)

      // Insert leaf jobs and update flow nodes with job IDs
      for (const job of leafJobs) {
        const matchingNode = nodes.find((n) => n.id === job.flowNodeId)
        const jobEntity = jobRepo.create({
          attempts: job.attempts,
          cancellationReason: null,
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
        })
        const saved = await jobRepo.save(jobEntity)

        // Update the flow node with the created job ID
        if (job.flowNodeId) {
          await flowRepo.update(job.flowNodeId, { jobId: saved.id })
        }
      }

      // Re-fetch all nodes to get updated jobId values
      const finalNodes = await flowRepo.findBy(nodes.map((n) => ({ id: n.id })))
      return finalNodes.map((e) =>
        PostgresTypeormQueueAdapter.transformFlowEntity(e)
      )
    })
  }

  async getFlowNode(nodeId: string): Promise<FlowNode | null> {
    const entity = await this.flowRepo.findOneBy({ id: nodeId })
    return entity
      ? PostgresTypeormQueueAdapter.transformFlowEntity(entity)
      : null
  }

  async getFlowTree(flowId: string): Promise<FlowTree | null> {
    const rows = await this.flowRepo.findBy({ flowId })
    if (rows.length === 0) {
      return null
    }

    const allNodes = rows.map((r) =>
      PostgresTypeormQueueAdapter.transformFlowEntity(r)
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

    const qb = this.flowRepo
      .createQueryBuilder("flow")
      .where("flow.parentNodeId IS NULL")
      .orderBy("flow.createdAt", "DESC")
      .take(limit)
      .skip(offset)

    if (options?.status) {
      qb.andWhere("flow.status = :status", { status: options.status })
    }

    const rows = await qb.getMany()
    return rows.map((r) => {
      const node = PostgresTypeormQueueAdapter.transformFlowEntity(r)
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
    const updates: Record<string, unknown> = {}

    if (update.status !== undefined) {
      updates.status = update.status
    }
    if (update.jobId !== undefined) {
      updates.jobId = update.jobId
    }
    if (update.result !== undefined) {
      updates.result = update.result
    }
    if (update.error !== undefined) {
      updates.error = update.error
    }
    if (update.completedAt !== undefined) {
      updates.completedAt = update.completedAt
    }

    await this.flowRepo.update(nodeId, updates)
  }

  async incrementNodeChildrenCompleted(
    nodeId: string
  ): Promise<{ completed: number; total: number }> {
    await this.flowRepo.increment({ id: nodeId }, "childrenCompleted", 1)
    const updated = await this.flowRepo.findOneBy({ id: nodeId })
    return {
      completed: updated?.childrenCompleted ?? 0,
      total: updated?.childrenCount ?? 0,
    }
  }

  async getNodeChildren(nodeId: string): Promise<readonly FlowNode[]> {
    const rows = await this.flowRepo.findBy({ parentNodeId: nodeId })
    return rows.map((r) => PostgresTypeormQueueAdapter.transformFlowEntity(r))
  }

  async getChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const rows = await this.flowRepo
      .createQueryBuilder("flow")
      .where("flow.parentNodeId = :nodeId", { nodeId })
      .andWhere("flow.status = :status", { status: "completed" })
      .getMany()

    const results = new Map<string, unknown>()
    for (const row of rows) {
      results.set(row.id, row.result)
    }
    return results
  }

  async getFailedChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const rows = await this.flowRepo
      .createQueryBuilder("flow")
      .where("flow.parentNodeId = :nodeId", { nodeId })
      .andWhere("flow.status = :status", { status: "failed" })
      .getMany()

    const results = new Map<string, unknown>()
    for (const row of rows) {
      results.set(row.id, row.error)
    }
    return results
  }

  async cancelUnprocessedChildren(nodeId: string): Promise<number> {
    const children = await this.flowRepo.findBy({ parentNodeId: nodeId })

    let cancelled = 0
    const now = new Date()

    for (const child of children) {
      if (child.status === "waiting") {
        await this.flowRepo.update(child.id, {
          status: "cancelled",
          completedAt: now,
        })
        cancelled++
        cancelled += await this.cancelUnprocessedChildren(child.id)
      } else if (child.status === "ready" && child.jobId) {
        // Cancel the corresponding job if still pending/delayed
        const result = await this.repo
          .createQueryBuilder()
          .update()
          .set({ cancelledAt: now, status: "cancelled" })
          .where("id = :id", { id: child.jobId })
          .andWhere("status IN (:...statuses)", {
            statuses: ["pending", "delayed"],
          })
          .execute()

        if ((result.affected ?? 0) > 0) {
          await this.flowRepo.update(child.id, {
            status: "cancelled",
            completedAt: now,
          })
          cancelled++
        }
        cancelled += await this.cancelUnprocessedChildren(child.id)
      }
    }

    return cancelled
  }

  async deleteFlow(flowId: string): Promise<number> {
    const result = await this.flowRepo
      .createQueryBuilder()
      .delete()
      .where("flowId = :flowId", { flowId })
      .execute()
    return result.affected ?? 0
  }

  async cleanupFlows(keepCount: number): Promise<number> {
    // Find root nodes of completed flows, ordered by creation time
    const rootNodes = await this.flowRepo
      .createQueryBuilder("flow")
      .select("flow.flowId")
      .where("flow.parentNodeId IS NULL")
      .andWhere("flow.status = :status", { status: "completed" })
      .orderBy("flow.createdAt", "DESC")
      .skip(keepCount)
      .getMany()

    if (rootNodes.length === 0) {
      return 0
    }

    const flowIdsToDelete = rootNodes.map((r) => r.flowId)
    const result = await this.flowRepo
      .createQueryBuilder()
      .delete()
      .where("flowId IN (:...flowIds)", { flowIds: flowIdsToDelete })
      .execute()

    return result.affected ?? 0
  }
}
