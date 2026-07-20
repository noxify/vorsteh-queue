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
  TypeormAdapterProps,
} from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"
import type { JobWhereInput } from "@vorsteh-queue/query-builder"
import { normalizeWhere } from "@vorsteh-queue/query-builder"
import type { DataSource, Repository } from "typeorm"

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
export class PostgresTypeormQueueAdapter extends BaseQueueAdapter {
  private dataSource: DataSource
  private repo!: Repository<QueueJobEntity>
  private readonly fullTable: string

  constructor(dataSource: DataSource, adapterConfig?: TypeormAdapterProps) {
    super()
    this.dataSource = dataSource

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
    if (!this.dataSource.isInitialized) {
      await this.dataSource.initialize()
    }
    this.repo = this.dataSource.getRepository(QueueJobEntity)
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

  async getFlows(
    options?: PaginationOptions
  ): Promise<readonly { flowId: string; rootJob: Job }[]> {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const rows = await this.repo
      .createQueryBuilder("job")
      .where("job.queueName = :queueName", { queueName: this.queueName })
      .andWhere("job.flowId IS NOT NULL")
      .andWhere("job.parentId IS NULL")
      .orderBy("job.createdAt", "DESC")
      .take(limit)
      .skip(offset)
      .getMany()

    return rows.map((r) => {
      const job = PostgresTypeormQueueAdapter.transformEntity(r)
      // oxlint-disable-next-line typescript/no-non-null-assertion
      return { flowId: job.flowId!, rootJob: job }
    })
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

  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    const jobs = await this.repo.find({
      where: { flowId, queueName: this.queueName },
    })
    if (jobs.length === 0) {
      return null
    }

    const allJobs = jobs.map((j) =>
      PostgresTypeormQueueAdapter.transformEntity(j)
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
    const [, count] = (await this.dataSource.query(
      `DELETE FROM ${this.fullTable} WHERE queue_name = $1 AND flow_id = $2`,
      [this.queueName, flowId]
    )) as [unknown, number]
    return count
  }

  async incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }> {
    await this.repo.increment({ id: parentId }, "childrenCompleted", 1)
    const updated = await this.repo.findOneBy({ id: parentId })
    return {
      completed: updated?.childrenCompleted ?? 0,
      total: updated?.childrenCount ?? 0,
    }
  }

  async getChildrenJobs(parentId: string): Promise<readonly Job[]> {
    const jobs = await this.repo.find({
      where: { parentId, queueName: this.queueName },
    })
    return jobs.map((j) => PostgresTypeormQueueAdapter.transformEntity(j))
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
      childrenCompleted: entity.childrenCompleted ?? 0,
      childrenCount: entity.childrenCount ?? 0,
      completedAt: entity.completedAt ?? undefined,
      createdAt: entity.createdAt,
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
      id: entity.id,
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
