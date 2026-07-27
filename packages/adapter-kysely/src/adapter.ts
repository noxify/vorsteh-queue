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
import { buildWhere } from "@vorsteh-queue/query-builder/kysely"
import type { Kysely } from "kysely"
import { sql } from "kysely"

import type { DB, InsertQueueJobValue, QueueFlow, QueueJob } from "./types"

/**
 * PostgreSQL adapter for the queue system using Kysely.
 *
 * @example
 * ```typescript
 * import { Kysely } from "kysely"
 * import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-kysely"
 *
 * const adapter = new PostgresQueueAdapter(db)
 * ```
 */
export class PostgresQueueAdapter
  extends BaseQueueAdapter
  implements FlowAdapter
{
  private customDbClient: Kysely<DB>
  private tableName: string
  private schemaName: string
  private flowTableName: string

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: Kysely<any>,
    adapterConfig?: AdapterProps<"kysely">
  ) {
    super()
    this.customDbClient = db as Kysely<DB>
    this.tableName = adapterConfig?.tableName ?? "queue_jobs"
    this.schemaName = adapterConfig?.schemaName ?? "public"
    this.flowTableName = adapterConfig?.flowTableName ?? "queue_flows"
  }

  private get table() {
    return `${this.schemaName}.${this.tableName}` as unknown as "tablename"
  }

  private get flowTable() {
    return `${this.schemaName}.${this.flowTableName}` as unknown as "flowtablename"
  }

  // eslint-disable-next-line class-methods-use-this, no-empty-function
  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    await this.customDbClient.destroy()
  }

  async addJob(job: NewJob): Promise<Job> {
    const result = await this.customDbClient
      .insertInto(this.table)
      .values({
        attempts: job.attempts,
        cron: job.cron ?? null,
        flow_node_id: job.flowNodeId ?? null,
        group_key: job.groupKey ?? null,
        max_attempts: job.maxAttempts,
        name: job.name,
        payload: job.payload,
        priority: job.priority,
        process_at: sql`${job.processAt.toISOString()}::timestamptz`,
        progress: job.progress ?? 0,
        queue_name: this.queueName,
        repeat_count: job.repeatCount ?? 0,
        repeat_every: job.repeatEvery ?? null,
        repeat_limit: job.repeatLimit ?? null,
        status: job.status,
        timeout: typeof job.timeout === "number" ? job.timeout : null,
        unique_key: job.uniqueKey ?? null,
      })
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error("Failed to create job")
    }
    return this.transformJob(result)
  }

  async addJobs(jobs: readonly NewJob[]): Promise<readonly Job[]> {
    if (jobs.length === 0) {
      return []
    }

    const values: InsertQueueJobValue[] = jobs.map((job) => ({
      attempts: job.attempts,
      cron: job.cron ?? null,
      flow_node_id: job.flowNodeId ?? null,
      group_key: job.groupKey ?? null,
      max_attempts: job.maxAttempts,
      name: job.name,
      payload: job.payload,
      priority: job.priority,
      process_at: sql`${job.processAt.toISOString()}::timestamptz`,
      progress: job.progress ?? 0,
      queue_name: this.queueName,
      repeat_count: job.repeatCount ?? 0,
      repeat_every: job.repeatEvery ?? null,
      repeat_limit: job.repeatLimit ?? null,
      status: job.status,
      timeout: typeof job.timeout === "number" ? job.timeout : null,
      unique_key: job.uniqueKey ?? null,
    }))

    const results = await this.customDbClient
      .insertInto(this.table)
      .values(values)
      .returningAll()
      .execute()

    return results.map((row) => this.transformJob(row))
  }

  async getJobById(id: string): Promise<Job | null> {
    const job = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("id", "=", id)
      .where("queue_name", "=", this.queueName)
      .executeTakeFirst()

    return job ? this.transformJob(job) : null
  }

  async getNextJob(options: GetNextJobOptions): Promise<Job | null> {
    const now = new Date()

    // Promote delayed jobs that are ready
    const delayed = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "delayed")
      .where("process_at", "<=", now)
      .where("name", "in", [...options.handlerNames])
      .where(({ eb }) => eb(eb.ref("attempts"), "<", eb.ref("max_attempts")))
      .orderBy("priority", "asc")
      .orderBy("created_at", "asc")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst()

    if (delayed) {
      await this.customDbClient
        .updateTable(this.table)
        .set({ status: "pending" })
        .where("id", "=", delayed.id)
        .execute()
    }

    // Move exhausted delayed jobs to dead (safety net)
    await this.customDbClient
      .updateTable(this.table)
      .set({ status: "dead" })
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "delayed")
      .where("process_at", "<=", now)
      .where(({ eb }) => eb(eb.ref("attempts"), ">=", eb.ref("max_attempts")))
      .execute()

    // Pick next pending job
    let query = this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "pending")
      .where("name", "in", [...options.handlerNames])

    if (options.activeGroups.length > 0) {
      query = query.where((eb) =>
        eb.or([
          eb("group_key", "is", null),
          eb("group_key", "not in", [...options.activeGroups]),
        ])
      )
    }

    const job = await query
      .orderBy("priority", "asc")
      .orderBy("created_at", "asc")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst()

    return job ? this.transformJob(job) : null
  }

  async getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    let query = this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "pending")
      .where("name", "=", handlerName)

    if (groupConstraints.length > 0) {
      query = query.where((eb) =>
        eb.or([
          eb("group_key", "is", null),
          eb("group_key", "not in", [...groupConstraints]),
        ])
      )
    }

    const jobs = await query
      .orderBy("priority", "asc")
      .orderBy("created_at", "asc")
      .limit(count)
      .forUpdate()
      .skipLocked()
      .execute()

    return jobs.map((row) => this.transformJob(row))
  }

  async updateJobStatus(id: string, update: JobStatusUpdate): Promise<void> {
    const now = new Date()
    const updates: Record<string, unknown> = { status: update.status }

    if (update.error) {
      updates.error = update.error
    }
    if (update.result !== undefined) {
      updates.result = update.result
    }
    if (update.processAt) {
      updates.process_at = update.processAt
    }
    if (update.cancellationReason) {
      updates.cancellation_reason = update.cancellationReason
    }
    if (update.status === "processing") {
      updates.processed_at = now
    }
    if (update.status === "completed") {
      updates.completed_at = now
    }
    if (update.status === "failed") {
      updates.failed_at = now
    }
    if (update.status === "cancelled") {
      updates.cancelled_at = now
    }

    await this.customDbClient
      .updateTable(this.table)
      .set(updates)
      .where("id", "=", id)
      .execute()
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.customDbClient
      .updateTable(this.table)
      .set({ attempts: sql`attempts + 1` })
      .where("id", "=", id)
      .execute()
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, progress))
    await this.customDbClient
      .updateTable(this.table)
      .set({ progress: normalized })
      .where("id", "=", id)
      .execute()
  }

  async cancelJob(id: string, reason?: string): Promise<boolean> {
    const job = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("id", "=", id)
      .where("queue_name", "=", this.queueName)
      .executeTakeFirst()

    if (!job) {
      return false
    }
    const cancellable = ["pending", "delayed", "processing", "failed"]
    if (!cancellable.includes(job.status)) {
      return false
    }

    await this.customDbClient
      .updateTable(this.table)
      .set({
        cancellation_reason: reason ?? null,
        cancelled_at: new Date(),
        status: "cancelled",
      })
      .where("id", "=", id)
      .execute()

    return true
  }

  async cancelJobs(filter: CancelJobsFilter): Promise<number> {
    let query = this.customDbClient
      .updateTable(this.table)
      .set({ cancelled_at: new Date(), status: "cancelled" })
      .where("queue_name", "=", this.queueName)
      .where("status", "in", ["pending", "delayed", "processing", "failed"])

    if (filter.name) {
      query = query.where("name", "=", filter.name)
    }
    if (filter.status) {
      query = query.where("status", "=", filter.status)
    }
    if (filter.group) {
      query = query.where("group_key", "=", filter.group)
    }

    const result = await query.executeTakeFirst()
    return Number(result.numUpdatedRows)
  }

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    const jobs = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "dead")
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute()

    return jobs.map((row) => this.transformJob(row))
  }

  async redriveJob(id: string): Promise<void> {
    await this.customDbClient
      .updateTable(this.table)
      .set({
        attempts: 0,
        error: null,
        failed_at: null,
        process_at: new Date(),
        progress: 0,
        status: "pending",
      })
      .where("id", "=", id)
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "dead")
      .execute()
  }

  async redriveJobs(filter?: { name?: string }): Promise<number> {
    let query = this.customDbClient
      .updateTable(this.table)
      .set({
        attempts: 0,
        error: null,
        failed_at: null,
        process_at: new Date(),
        progress: 0,
        status: "pending",
      })
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "dead")

    if (filter?.name) {
      query = query.where("name", "=", filter.name)
    }

    const result = await query.executeTakeFirst()
    return Number(result.numUpdatedRows)
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.customDbClient
      .selectFrom(this.table)
      .select(({ fn }) => ["status", fn.countAll<number>().as("count")])
      .where("queue_name", "=", this.queueName)
      .groupBy("status")
      .execute()

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

    let query = this.customDbClient
      .selectFrom(this.table)
      .select(({ fn }) => [fn.countAll<number>().as("count")])
      .where("queue_name", "=", this.queueName)

    query = hasFilter
      ? (buildWhere(query, normalized) as typeof query)
      : query.where("status", "in", ["pending", "delayed"])

    const result = await query.executeTakeFirst()
    return Number(result?.count ?? 0)
  }

  async getJobs(options: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const normalized = normalizeWhere(options.where)

    let query = this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("queue_name", "=", this.queueName)

    if (Object.keys(normalized).length > 0) {
      query = buildWhere(query, normalized) as typeof query
    }

    const rows = await query
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute()

    return rows.map((row) => this.transformJob(row as QueueJob))
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    let query = this.customDbClient
      .deleteFrom(this.table)
      .where("queue_name", "=", this.queueName)

    if (status) {
      query = query.where("status", "=", status)
    }

    const result = await query.executeTakeFirst()
    return Number(result.numDeletedRows)
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    const jobsToDelete = await this.customDbClient
      .selectFrom(this.table)
      .select("id")
      .where("queue_name", "=", this.queueName)
      .where("status", "=", status)
      .orderBy("created_at", "desc")
      .offset(keepCount)
      .execute()

    if (jobsToDelete.length === 0) {
      return 0
    }

    const idsToDelete = jobsToDelete.map((j) => j.id)

    const result = await this.customDbClient
      .deleteFrom(this.table)
      .where("queue_name", "=", this.queueName)
      .where("id", "in", idsToDelete)
      .executeTakeFirst()

    return Number(result.numDeletedRows)
  }

  async findJobByUniqueKey(uniqueKey: string): Promise<Job | null> {
    const job = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("unique_key", "=", uniqueKey)
      .where("status", "not in", ["completed", "cancelled", "dead"])
      .executeTakeFirst()

    return job ? this.transformJob(job) : null
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.customDbClient.transaction().execute(async () => fn())
  }

  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    await this.customDbClient
      .updateTable(this.table)
      .set({ steps: JSON.stringify(steps) })
      .where("id", "=", id)
      .execute()
  }

  async retryJob(id: string): Promise<boolean> {
    const job = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("id", "=", id)
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "failed")
      .executeTakeFirst()
    if (!job) {
      return false
    }

    await this.customDbClient
      .updateTable(this.table)
      .set({
        attempts: 0,
        error: null,
        failed_at: null,
        process_at: new Date(),
        progress: 0,
        status: "pending",
      })
      .where("id", "=", id)
      .execute()
    return true
  }

  async runJobNow(id: string): Promise<boolean> {
    const job = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("id", "=", id)
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "delayed")
      .executeTakeFirst()
    if (!job) {
      return false
    }

    await this.customDbClient
      .updateTable(this.table)
      .set({ process_at: new Date(), status: "pending" })
      .where("id", "=", id)
      .execute()
    return true
  }

  async deleteJob(id: string): Promise<boolean> {
    const result = await this.customDbClient
      .deleteFrom(this.table)
      .where("id", "=", id)
      .where("queue_name", "=", this.queueName)
      .executeTakeFirst()
    return Number(result.numDeletedRows) > 0
  }

  async setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean> {
    const job = await this.customDbClient
      .selectFrom(this.table)
      .selectAll()
      .where("id", "=", id)
      .where("queue_name", "=", this.queueName)
      .executeTakeFirst()
    if (!job) {
      return false
    }

    const existing = (job.signals as Record<string, unknown>) ?? {}
    const signals = { ...existing, [event]: data }
    await this.customDbClient
      .updateTable(this.table)
      .set({
        process_at: new Date(),
        signals: JSON.stringify(signals),
        status: "pending",
      })
      .where("id", "=", id)
      .execute()
    return true
  }

  // eslint-disable-next-line class-methods-use-this -- property mapping, not logical complexity
  private transformJob(job: QueueJob): Job {
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
      payload: job.payload,
      priority: job.priority,
      processAt: job.process_at,
      processedAt: job.processed_at ?? undefined,
      progress: job.progress ?? 0,
      repeatCount: job.repeat_count ?? 0,
      repeatEvery: job.repeat_every ?? undefined,
      repeatLimit: job.repeat_limit ?? undefined,
      result: job.result ?? undefined,
      signals: job.signals as Readonly<Record<string, unknown>> | undefined,
      status: job.status as JobStatus,
      steps: job.steps as StepState[] | undefined,
      timeout: job.timeout ?? undefined,
      uniqueKey: job.unique_key ?? undefined,
    }
  }

  // eslint-disable-next-line class-methods-use-this -- property mapping
  private transformFlowNode(row: QueueFlow): FlowNode {
    return {
      id: row.id,
      flowId: row.flow_id,
      parentNodeId: row.parent_node_id ?? undefined,
      jobId: row.job_id ?? undefined,
      queueName: row.queue_name,
      name: row.name,
      payload: row.payload,
      options: row.options as FlowNode["options"],
      status: row.status as FlowNode["status"],
      failureStrategy: row.failure_strategy as FlowNode["failureStrategy"],
      childrenCount: row.children_count,
      childrenCompleted: row.children_completed,
      result: row.result ?? undefined,
      error: row.error as SerializedError | undefined,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
    }
  }

  // ─── FlowAdapter Implementation ──────────────────────────────────────────

  async createFlow(
    nodes: readonly NewFlowNode[],
    leafJobs: readonly NewJob[]
  ): Promise<readonly FlowNode[]> {
    return this.customDbClient.transaction().execute(async (tx) => {
      // Insert all flow nodes with pre-generated IDs
      for (const n of nodes) {
        await tx
          .insertInto(this.flowTable)
          .values({
            id: n.id,
            flow_id: n.flowId,
            parent_node_id: n.parentNodeId ?? null,
            job_id: n.jobId ?? null,
            queue_name: n.queueName,
            name: n.name,
            payload: n.payload,
            options: n.options ? JSON.stringify(n.options) : null,
            status: n.status,
            failure_strategy: n.failureStrategy,
            children_count: n.childrenCount,
            children_completed: n.childrenCompleted,
          })
          .execute()
      }

      // Insert leaf jobs and correlate with their flow nodes
      for (const job of leafJobs) {
        const matchingNode = nodes.find((n) => n.id === job.flowNodeId)
        const result = await tx
          .insertInto(this.table)
          .values({
            attempts: job.attempts,
            cron: job.cron ?? null,
            flow_node_id: job.flowNodeId ?? null,
            group_key: job.groupKey ?? null,
            max_attempts: job.maxAttempts,
            name: job.name,
            payload: job.payload,
            priority: job.priority,
            process_at: sql`${job.processAt.toISOString()}::timestamptz`,
            progress: job.progress ?? 0,
            queue_name: matchingNode?.queueName ?? this.queueName,
            repeat_count: job.repeatCount ?? 0,
            repeat_every: job.repeatEvery ?? null,
            repeat_limit: job.repeatLimit ?? null,
            status: job.status,
            timeout: typeof job.timeout === "number" ? job.timeout : null,
            unique_key: job.uniqueKey ?? null,
          })
          .returningAll()
          .executeTakeFirst()

        if (result && job.flowNodeId) {
          await tx
            .updateTable(this.flowTable)
            .set({ job_id: result.id })
            .where("id", "=", job.flowNodeId)
            .execute()
        }
      }

      // Re-fetch all nodes to get updated job_id values
      const finalNodes = await tx
        .selectFrom(this.flowTable)
        .selectAll()
        .where(
          "id",
          "in",
          nodes.map((n) => n.id)
        )
        .execute()

      return finalNodes.map((row) => this.transformFlowNode(row as QueueFlow))
    })
  }

  async getFlowNode(nodeId: string): Promise<FlowNode | null> {
    const row = await this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("id", "=", nodeId)
      .executeTakeFirst()

    return row ? this.transformFlowNode(row as QueueFlow) : null
  }

  async getFlowTree(flowId: string): Promise<FlowTree | null> {
    const rows = await this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("flow_id", "=", flowId)
      .execute()

    if (rows.length === 0) {
      return null
    }

    const allNodes = rows.map((r) => this.transformFlowNode(r as QueueFlow))
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

    let query = this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("parent_node_id", "is", null)

    if (options?.status) {
      query = query.where("status", "=", options.status)
    }

    const rows = await query
      .orderBy("created_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute()

    return rows.map((r) => {
      const node = this.transformFlowNode(r as QueueFlow)
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
      updates.job_id = update.jobId
    }
    if (update.result !== undefined) {
      updates.result = update.result
    }
    if (update.error !== undefined) {
      updates.error = update.error
    }
    if (update.completedAt !== undefined) {
      updates.completed_at = update.completedAt
    }

    await this.customDbClient
      .updateTable(this.flowTable)
      .set(updates)
      .where("id", "=", nodeId)
      .execute()
  }

  async incrementNodeChildrenCompleted(
    nodeId: string
  ): Promise<{ completed: number; total: number }> {
    await this.customDbClient
      .updateTable(this.flowTable)
      .set({ children_completed: sql`children_completed + 1` })
      .where("id", "=", nodeId)
      .execute()

    const updated = await this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("id", "=", nodeId)
      .executeTakeFirst()

    if (!updated) {
      return { completed: 0, total: 0 }
    }

    return {
      completed: (updated as QueueFlow).children_completed,
      total: (updated as QueueFlow).children_count,
    }
  }

  async getNodeChildren(nodeId: string): Promise<readonly FlowNode[]> {
    const rows = await this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("parent_node_id", "=", nodeId)
      .execute()

    return rows.map((r) => this.transformFlowNode(r as QueueFlow))
  }

  async getChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const rows = await this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("parent_node_id", "=", nodeId)
      .where("status", "=", "completed")
      .execute()

    const results = new Map<string, unknown>()
    for (const row of rows) {
      results.set((row as QueueFlow).id, (row as QueueFlow).result)
    }
    return results
  }

  async getFailedChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const rows = await this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("parent_node_id", "=", nodeId)
      .where("status", "=", "failed")
      .execute()

    const results = new Map<string, unknown>()
    for (const row of rows) {
      results.set((row as QueueFlow).id, (row as QueueFlow).error)
    }
    return results
  }

  async cancelUnprocessedChildren(nodeId: string): Promise<number> {
    const children = await this.customDbClient
      .selectFrom(this.flowTable)
      .selectAll()
      .where("parent_node_id", "=", nodeId)
      .execute()

    let cancelled = 0
    const now = new Date()

    for (const child of children) {
      const typedChild = child as QueueFlow
      // Cancel waiting nodes (no job yet)
      if (typedChild.status === "waiting") {
        await this.customDbClient
          .updateTable(this.flowTable)
          .set({ status: "cancelled", completed_at: now })
          .where("id", "=", typedChild.id)
          .execute()
        cancelled++
        // Recursively cancel subtree
        cancelled += await this.cancelUnprocessedChildren(typedChild.id)
      } else if (typedChild.status === "ready" && typedChild.job_id) {
        // Cancel the corresponding job if it's still pending/delayed
        const result = await this.customDbClient
          .updateTable(this.table)
          .set({ cancelled_at: now, status: "cancelled" })
          .where("id", "=", typedChild.job_id)
          .where("status", "in", ["pending", "delayed"])
          .executeTakeFirst()

        if (Number(result.numUpdatedRows) > 0) {
          await this.customDbClient
            .updateTable(this.flowTable)
            .set({ status: "cancelled", completed_at: now })
            .where("id", "=", typedChild.id)
            .execute()
          cancelled++
        }
        // Recursively cancel subtree
        cancelled += await this.cancelUnprocessedChildren(typedChild.id)
      }
    }

    return cancelled
  }

  async deleteFlow(flowId: string): Promise<number> {
    const result = await this.customDbClient
      .deleteFrom(this.flowTable)
      .where("flow_id", "=", flowId)
      .executeTakeFirst()
    return Number(result.numDeletedRows)
  }

  async cleanupFlows(keepCount: number): Promise<number> {
    // Find root nodes of completed flows, ordered by creation time
    const rootNodes = await this.customDbClient
      .selectFrom(this.flowTable)
      .select("flow_id")
      .where("parent_node_id", "is", null)
      .where("status", "=", "completed")
      .orderBy("created_at", "desc")
      .offset(keepCount)
      .execute()

    if (rootNodes.length === 0) {
      return 0
    }

    const flowIdsToDelete = rootNodes.map((r) => r.flow_id)

    const result = await this.customDbClient
      .deleteFrom(this.flowTable)
      .where("flow_id", "in", flowIdsToDelete)
      .executeTakeFirst()

    return Number(result.numDeletedRows)
  }
}
