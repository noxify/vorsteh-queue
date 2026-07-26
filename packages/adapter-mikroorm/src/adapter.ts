import type { MikroORM } from "@mikro-orm/postgresql"
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
  MikroormAdapterProps,
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
export class PostgresMikroormQueueAdapter
  extends BaseQueueAdapter
  implements FlowAdapter
{
  private orm: MikroORM
  private readonly fullTable: string
  private readonly fullFlowTable: string

  constructor(orm: MikroORM, adapterConfig?: MikroormAdapterProps) {
    super()
    this.orm = orm

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
         AND attempts < max_attempts
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

    // Move exhausted delayed jobs to dead (safety net)
    await connection.execute(
      `UPDATE ${this.fullTable} SET status = 'dead'
       WHERE queue_name = ? AND status = 'delayed' AND process_at <= NOW()
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

  // ─── FlowAdapter Implementation ─────────────────────────────────────────────

  async createFlow(
    nodes: readonly NewFlowNode[],
    leafJobs: readonly NewJob[]
  ): Promise<readonly FlowNode[]> {
    const em = this.orm.em.fork()
    return em.transactional(async (txEm) => {
      // Insert all flow nodes with pre-generated IDs
      for (const n of nodes) {
        const entity = txEm.create(QueueFlowEntity, {
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
        txEm.persist(entity)
      }
      await txEm.flush()

      // Insert leaf jobs and update flow nodes with job IDs
      for (const job of leafJobs) {
        const matchingNode = nodes.find((n) => n.id === job.flowNodeId)
        const jobEntity = txEm.create(QueueJobEntity, {
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
        txEm.persist(jobEntity)
        await txEm.flush()

        // Update the flow node with the created job ID
        if (job.flowNodeId) {
          await txEm.nativeUpdate(
            QueueFlowEntity,
            { id: job.flowNodeId },
            { jobId: jobEntity.id }
          )
        }
      }

      // Re-fetch all nodes to get updated jobId values
      // oxlint-disable-next-line unicorn/no-array-method-this-argument
      const finalNodes = await txEm.find(QueueFlowEntity, {
        id: { $in: nodes.map((n) => n.id) },
      })
      return finalNodes.map((e) =>
        PostgresMikroormQueueAdapter.transformFlowEntity(e)
      )
    })
  }

  async getFlowNode(nodeId: string): Promise<FlowNode | null> {
    const em = this.orm.em.fork()
    const entity = await em.findOne(QueueFlowEntity, { id: nodeId })
    return entity
      ? PostgresMikroormQueueAdapter.transformFlowEntity(entity)
      : null
  }

  async getFlowTree(flowId: string): Promise<FlowTree | null> {
    const em = this.orm.em.fork()
    // oxlint-disable-next-line unicorn/no-array-method-this-argument
    const rows = await em.find(QueueFlowEntity, { flowId })
    if (rows.length === 0) {
      return null
    }

    const allNodes = rows.map((r) =>
      PostgresMikroormQueueAdapter.transformFlowEntity(r)
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
    const em = this.orm.em.fork()
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { parentNodeId: null }
    if (options?.status) {
      where.status = options.status
    }

    const rows = await em.find(QueueFlowEntity, where, {
      orderBy: { createdAt: "DESC" },
      limit,
      offset,
    })

    return rows.map((r) => {
      const node = PostgresMikroormQueueAdapter.transformFlowEntity(r)
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
    const em = this.orm.em.fork()
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

    await em.nativeUpdate(QueueFlowEntity, { id: nodeId }, updates)
  }

  async incrementNodeChildrenCompleted(
    nodeId: string
  ): Promise<{ completed: number; total: number }> {
    const connection = this.orm.em.getConnection()
    await connection.execute(
      `UPDATE ${this.fullFlowTable} SET children_completed = children_completed + 1 WHERE id = ?`,
      [nodeId]
    )
    const em = this.orm.em.fork()
    const updated = await em.findOne(QueueFlowEntity, { id: nodeId })
    return {
      completed: updated?.childrenCompleted ?? 0,
      total: updated?.childrenCount ?? 0,
    }
  }

  async getNodeChildren(nodeId: string): Promise<readonly FlowNode[]> {
    const em = this.orm.em.fork()
    // oxlint-disable-next-line unicorn/no-array-method-this-argument
    const rows = await em.find(QueueFlowEntity, { parentNodeId: nodeId })
    return rows.map((r) => PostgresMikroormQueueAdapter.transformFlowEntity(r))
  }

  async getChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const em = this.orm.em.fork()
    // oxlint-disable-next-line unicorn/no-array-method-this-argument
    const rows = await em.find(QueueFlowEntity, {
      parentNodeId: nodeId,
      status: "completed",
    })

    const results = new Map<string, unknown>()
    for (const row of rows) {
      // oxlint-disable-next-line typescript/no-non-null-assertion
      results.set(row.id!, row.result)
    }
    return results
  }

  async getFailedChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const em = this.orm.em.fork()
    // oxlint-disable-next-line unicorn/no-array-method-this-argument
    const rows = await em.find(QueueFlowEntity, {
      parentNodeId: nodeId,
      status: "failed",
    })

    const results = new Map<string, unknown>()
    for (const row of rows) {
      // oxlint-disable-next-line typescript/no-non-null-assertion
      results.set(row.id!, row.error)
    }
    return results
  }

  async cancelUnprocessedChildren(nodeId: string): Promise<number> {
    const em = this.orm.em.fork()
    // oxlint-disable-next-line unicorn/no-array-method-this-argument
    const children = await em.find(QueueFlowEntity, { parentNodeId: nodeId })

    let cancelled = 0
    const now = new Date()

    for (const child of children) {
      if (child.status === "waiting") {
        await em.nativeUpdate(
          QueueFlowEntity,
          { id: child.id },
          { status: "cancelled", completedAt: now }
        )
        cancelled++
        cancelled += await this.cancelUnprocessedChildren(child.id as string)
      } else if (child.status === "ready" && child.jobId) {
        // Cancel the corresponding job if still pending/delayed
        const jobEm = this.orm.em.fork()
        const updated = await jobEm.nativeUpdate(
          QueueJobEntity,
          { id: child.jobId, status: { $in: ["pending", "delayed"] } },
          { cancelledAt: now, status: "cancelled" }
        )

        if (updated > 0) {
          await em.nativeUpdate(
            QueueFlowEntity,
            { id: child.id },
            { status: "cancelled", completedAt: now }
          )
          cancelled++
        }
        cancelled += await this.cancelUnprocessedChildren(child.id as string)
      }
    }

    return cancelled
  }

  async deleteFlow(flowId: string): Promise<number> {
    const em = this.orm.em.fork()
    return em.nativeDelete(QueueFlowEntity, { flowId })
  }

  async cleanupFlows(keepCount: number): Promise<number> {
    const em = this.orm.em.fork()

    // Find root nodes of completed flows, ordered by creation time
    const rootNodes = await em.find(
      QueueFlowEntity,
      { parentNodeId: null, status: "completed" },
      { orderBy: { createdAt: "DESC" }, offset: keepCount, fields: ["flowId"] }
    )

    if (rootNodes.length === 0) {
      return 0
    }

    const flowIdsToDelete = rootNodes.map((r) => r.flowId)
    return em.nativeDelete(QueueFlowEntity, {
      flowId: { $in: flowIdsToDelete },
    })
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
      completedAt: entity.completedAt ?? undefined,
      // oxlint-disable-next-line typescript/no-non-null-assertion
      createdAt: entity.createdAt!,
      cron: entity.cron ?? undefined,
      error: entity.error as SerializedError | undefined,
      failedAt: entity.failedAt ?? undefined,
      flowNodeId: entity.flowNodeId ?? undefined,
      groupKey: entity.groupKey ?? undefined,
      // oxlint-disable-next-line typescript/no-non-null-assertion
      id: entity.id!,
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
      // oxlint-disable-next-line typescript/no-non-null-assertion
      createdAt: entity.createdAt!,
      completedAt: entity.completedAt ?? undefined,
    }
  }
}
