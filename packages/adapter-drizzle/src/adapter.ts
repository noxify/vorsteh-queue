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
import { buildWhere } from "@vorsteh-queue/query-builder/drizzle"
import type {
  AnyRelations,
  AnyTableFilter,
  DBQueryConfigOrderByObject,
  GetTableViewFieldSelection,
  TableFilter,
} from "drizzle-orm"
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  lte,
  relationsFilterToSQL,
  sql,
} from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PgliteDatabase } from "drizzle-orm/pglite"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type * as flowSchema from "./flow-schema"
import type * as schema from "./queue-schema"

type FullSchema = typeof schema

type DrizzleDatabase =
  | NodePgDatabase<AnyRelations>
  | PostgresJsDatabase<AnyRelations>
  | PgliteDatabase<AnyRelations>

interface QueueJobsQueryTable {
  findMany: (config?: {
    where?: TableFilter<FullSchema["queueJobs"]>
    orderBy?: DBQueryConfigOrderByObject<
      GetTableViewFieldSelection<FullSchema["queueJobs"]>
    >
    limit?: number
    offset?: number
  }) => Promise<unknown[]>
  findFirst: (config?: {
    where?: TableFilter<FullSchema["queueJobs"]>
  }) => Promise<unknown | undefined>
}

function getModelByModelName(
  db: DrizzleDatabase,
  modelName: string
): FullSchema["queueJobs"] {
  const tableConfig = db._.relations[modelName]
  if (!tableConfig?.table) {
    throw new Error(
      `Model with name ${modelName} not found in database relations`
    )
  }
  return tableConfig.table as FullSchema["queueJobs"]
}

type FullFlowSchema = typeof flowSchema

function tryGetFlowModelByName(
  db: DrizzleDatabase,
  modelName: string
): FullFlowSchema["queueFlows"] | null {
  const tableConfig = db._.relations[modelName]
  if (!tableConfig?.table) {
    return null
  }
  return tableConfig.table as FullFlowSchema["queueFlows"]
}

/**
 * PostgreSQL adapter for the queue system using Drizzle ORM.
 *
 * @example
 * ```typescript
 * import { drizzle } from "drizzle-orm/node-postgres"
 * import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
 *
 * const db = drizzle(pool)
 * const adapter = new PostgresQueueAdapter(db)
 * ```
 */
export class PostgresQueueAdapter<TDb extends DrizzleDatabase = DrizzleDatabase>
  extends BaseQueueAdapter
  implements FlowAdapter
{
  private db: TDb
  private model: FullSchema["queueJobs"]
  private modelName: string
  private flowModel: FullFlowSchema["queueFlows"] | null
  private flowModelName: string

  private get queryTable(): QueueJobsQueryTable {
    return this.db.query[this.modelName] as unknown as QueueJobsQueryTable
  }

  constructor(db: TDb, adapterConfig?: AdapterProps<"drizzle">) {
    super()
    this.db = db
    this.modelName = adapterConfig?.modelName ?? "queueJobs"
    this.model = getModelByModelName(db, this.modelName)
    this.flowModelName = adapterConfig?.flowModelName ?? "queueFlows"
    this.flowModel = tryGetFlowModelByName(db, this.flowModelName)
  }

  // eslint-disable-next-line class-methods-use-this, no-empty-function
  async connect(): Promise<void> {}
  // eslint-disable-next-line class-methods-use-this, no-empty-function
  async disconnect(): Promise<void> {}

  private requireFlowModel(): FullFlowSchema["queueFlows"] {
    if (!this.flowModel) {
      throw new Error(
        `Flow model "${this.flowModelName}" not found in database relations. ` +
          "Include the queueFlows schema in your Drizzle instance to use flow features."
      )
    }
    return this.flowModel
  }

  async addJob(job: NewJob): Promise<Job> {
    const [result] = await this.db
      .insert(this.model)
      .values({
        attempts: job.attempts,
        cron: job.cron ?? null,
        flowNodeId: job.flowNodeId ?? null,
        groupKey: job.groupKey ?? null,
        maxAttempts: job.maxAttempts,
        name: job.name,
        payload: job.payload,
        priority: job.priority,
        processAt: sql`${job.processAt.toISOString()}::timestamptz`,
        progress: job.progress ?? 0,
        queueName: this.queueName,
        repeatCount: job.repeatCount ?? 0,
        repeatEvery: job.repeatEvery ?? null,
        repeatLimit: job.repeatLimit ?? null,
        status: job.status,
        timeout: typeof job.timeout === "number" ? job.timeout : null,
        uniqueKey: job.uniqueKey ?? null,
      })
      .returning()

    if (!result) {
      throw new Error("Failed to create job")
    }
    return this.transformJob(result as schema.QueueJob)
  }

  async addJobs(jobs: readonly NewJob[]): Promise<readonly Job[]> {
    if (jobs.length === 0) {
      return []
    }

    const values = jobs.map((job) => ({
      attempts: job.attempts,
      cron: job.cron ?? null,
      flowNodeId: job.flowNodeId ?? null,
      groupKey: job.groupKey ?? null,
      maxAttempts: job.maxAttempts,
      name: job.name,
      payload: job.payload,
      priority: job.priority,
      processAt: sql`${job.processAt.toISOString()}::timestamptz`,
      progress: job.progress ?? 0,
      queueName: this.queueName,
      repeatCount: job.repeatCount ?? 0,
      repeatEvery: job.repeatEvery ?? null,
      repeatLimit: job.repeatLimit ?? null,
      status: job.status,
      timeout: typeof job.timeout === "number" ? job.timeout : null,
      uniqueKey: job.uniqueKey ?? null,
    }))

    const results = await this.db.insert(this.model).values(values).returning()
    return results.map((row) => this.transformJob(row as schema.QueueJob))
  }

  async getJobById(id: string): Promise<Job | null> {
    const job = await this.queryTable.findFirst({
      where: {
        id: { eq: id },
        queueName: { eq: this.queueName },
      } as AnyTableFilter,
    })
    return job ? this.transformJob(job as schema.QueueJob) : null
  }

  async getNextJob(options: GetNextJobOptions): Promise<Job | null> {
    const now = new Date()

    // Promote delayed jobs that are ready
    const [delayed] = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          eq(this.model.status, "delayed"),
          lte(this.model.processAt, now),
          inArray(this.model.name, [...options.handlerNames]),
          sql`${this.model.attempts} < ${this.model.maxAttempts}`
        )
      )
      .orderBy(asc(this.model.priority), asc(this.model.createdAt))
      .limit(1)
      .for("update", { skipLocked: true })

    if (delayed) {
      await this.db
        .update(this.model)
        .set({ status: "pending" })
        .where(eq(this.model.id, (delayed as schema.QueueJob).id))

      // Continue to pick from pending
    }

    // Move exhausted delayed jobs to dead (safety net)
    await this.db
      .update(this.model)
      .set({ status: "dead" })
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          eq(this.model.status, "delayed"),
          lte(this.model.processAt, now),
          sql`${this.model.attempts} >= ${this.model.maxAttempts}`
        )
      )

    // Build conditions
    const conditions = [
      eq(this.model.queueName, this.queueName),
      eq(this.model.status, "pending"),
      inArray(this.model.name, [...options.handlerNames]),
    ]

    // Group FIFO: exclude active groups
    if (options.activeGroups.length > 0) {
      conditions.push(
        sql`(${this.model.groupKey} IS NULL OR ${this.model.groupKey} NOT IN (${sql.join(
          options.activeGroups.map((g) => sql`${g}`),
          sql`, `
        )}))`
      )
    }

    const [job] = await this.db
      .select()
      .from(this.model)
      .where(and(...conditions))
      .orderBy(asc(this.model.priority), asc(this.model.createdAt))
      .limit(1)
      .for("update", { skipLocked: true })

    return job ? this.transformJob(job as schema.QueueJob) : null
  }

  async getNextJobsForHandler(
    handlerName: string,
    maxCount: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]> {
    const conditions = [
      eq(this.model.queueName, this.queueName),
      eq(this.model.status, "pending"),
      eq(this.model.name, handlerName),
    ]

    if (groupConstraints.length > 0) {
      conditions.push(
        sql`(${this.model.groupKey} IS NULL OR ${this.model.groupKey} NOT IN (${sql.join(
          groupConstraints.map((g) => sql`${g}`),
          sql`, `
        )}))`
      )
    }

    const jobs = await this.db
      .select()
      .from(this.model)
      .where(and(...conditions))
      .orderBy(asc(this.model.priority), asc(this.model.createdAt))
      .limit(maxCount)
      .for("update", { skipLocked: true })

    return jobs.map((row) => this.transformJob(row as schema.QueueJob))
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
      updates.processAt = update.processAt
    }
    if (update.cancellationReason) {
      updates.cancellationReason = update.cancellationReason
    }
    if (update.status === "processing") {
      updates.processedAt = now
    }
    if (update.status === "completed") {
      updates.completedAt = now
    }
    if (update.status === "failed") {
      updates.failedAt = now
    }
    if (update.status === "cancelled") {
      updates.cancelledAt = now
    }

    await this.db.update(this.model).set(updates).where(eq(this.model.id, id))
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.db
      .update(this.model)
      .set({ attempts: sql`${this.model.attempts} + 1` })
      .where(eq(this.model.id, id))
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const normalized = Math.max(0, Math.min(100, progress))
    await this.db
      .update(this.model)
      .set({ progress: normalized })
      .where(eq(this.model.id, id))
  }

  async cancelJob(id: string, reason?: string): Promise<boolean> {
    const job = await this.queryTable.findFirst({
      where: {
        id: { eq: id },
        queueName: { eq: this.queueName },
      } as AnyTableFilter,
    })

    if (!job) {
      return false
    }
    const typedJob = job as schema.QueueJob
    const cancellable = ["pending", "delayed", "processing", "failed"]
    if (!cancellable.includes(typedJob.status)) {
      return false
    }

    await this.db
      .update(this.model)
      .set({
        cancellationReason: reason ?? null,
        cancelledAt: new Date(),
        status: "cancelled",
      })
      .where(eq(this.model.id, id))

    return true
  }

  async cancelJobs(filter: CancelJobsFilter): Promise<number> {
    const conditions = [
      eq(this.model.queueName, this.queueName),
      inArray(this.model.status, [
        "pending",
        "delayed",
        "processing",
        "failed",
      ]),
    ]

    if (filter.name) {
      conditions.push(eq(this.model.name, filter.name))
    }
    if (filter.status) {
      conditions.push(eq(this.model.status, filter.status))
    }
    if (filter.group) {
      conditions.push(eq(this.model.groupKey, filter.group))
    }

    const results = await this.db
      .update(this.model)
      .set({ cancelledAt: new Date(), status: "cancelled" })
      .where(and(...conditions))
      .returning()

    return results.length
  }

  async getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]> {
    const limit = options?.limit ?? 50
    const offset = options?.offset ?? 0

    const jobs = await this.queryTable.findMany({
      where: {
        queueName: { eq: this.queueName },
        status: { eq: "dead" },
      } as AnyTableFilter,
      orderBy: { createdAt: "desc" },
      limit,
      offset,
    })

    return (jobs as schema.QueueJob[]).map((row: schema.QueueJob) =>
      this.transformJob(row)
    )
  }

  async redriveJob(id: string): Promise<void> {
    await this.db
      .update(this.model)
      .set({
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
        status: "pending",
      })
      .where(
        and(
          eq(this.model.id, id),
          eq(this.model.queueName, this.queueName),
          eq(this.model.status, "dead")
        )
      )
  }

  async redriveJobs(filter?: { name?: string }): Promise<number> {
    const conditions = [
      eq(this.model.queueName, this.queueName),
      eq(this.model.status, "dead"),
    ]
    if (filter?.name) {
      conditions.push(eq(this.model.name, filter.name))
    }

    const results = await this.db
      .update(this.model)
      .set({
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
        status: "pending",
      })
      .where(and(...conditions))
      .returning()

    return results.length
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.db
      .select({ count: count(), status: this.model.status })
      .from(this.model)
      .where(eq(this.model.queueName, this.queueName))
      .groupBy(this.model.status)

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
    const whereObj = hasFilter
      ? { ...buildWhere(normalized), queueName: { eq: this.queueName } }
      : {
          queueName: { eq: this.queueName },
          status: { in: ["pending", "delayed"] },
        }

    const sqlFilter = relationsFilterToSQL(this.model, whereObj)
    return await this.db.$count(this.model, sqlFilter)
  }

  async getJobs(options: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const normalized = normalizeWhere(options.where)
    const whereObj = buildWhere(normalized)

    const jobs = await this.queryTable.findMany({
      where: {
        ...whereObj,
        queueName: { eq: this.queueName },
      } as AnyTableFilter,
      orderBy: { createdAt: "desc" },
      limit,
      offset,
    })

    return (jobs as schema.QueueJob[]).map((row: schema.QueueJob) =>
      this.transformJob(row)
    )
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const conditions = [eq(this.model.queueName, this.queueName)]
    if (status) {
      conditions.push(eq(this.model.status, status))
    }

    const results = await this.db
      .delete(this.model)
      .where(and(...conditions))
      .returning()
    return results.length
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    const jobsToDelete = await this.db
      .select({ id: this.model.id })
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          eq(this.model.status, status)
        )
      )
      .orderBy(sql`${this.model.createdAt} DESC`)
      .offset(keepCount)

    if (jobsToDelete.length === 0) {
      return 0
    }

    const idsToDelete = jobsToDelete.map((j) => j.id)

    const results = await this.db
      .delete(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          inArray(this.model.id, idsToDelete)
        )
      )
      .returning()

    return results.length
  }

  async findJobByUniqueKey(uniqueKey: string): Promise<Job | null> {
    const terminalStatuses = ["completed", "cancelled", "dead"]

    const job = await this.queryTable.findFirst({
      where: {
        queueName: { eq: this.queueName },
        uniqueKey: { eq: uniqueKey },
        status: { notIn: terminalStatuses },
      } as AnyTableFilter,
    })

    return job ? this.transformJob(job as schema.QueueJob) : null
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.db.transaction(async () => fn())
  }

  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    await this.db.update(this.model).set({ steps }).where(eq(this.model.id, id))
  }

  async retryJob(id: string): Promise<boolean> {
    const job = await this.queryTable.findFirst({
      where: {
        id: { eq: id },
        queueName: { eq: this.queueName },
        status: { eq: "failed" },
      } as AnyTableFilter,
    })
    if (!job) {
      return false
    }

    await this.db
      .update(this.model)
      .set({
        attempts: 0,
        error: null,
        failedAt: null,
        processAt: new Date(),
        progress: 0,
        status: "pending",
      })
      .where(eq(this.model.id, id))
    return true
  }

  async runJobNow(id: string): Promise<boolean> {
    const job = await this.queryTable.findFirst({
      where: {
        id: { eq: id },
        queueName: { eq: this.queueName },
        status: { eq: "delayed" },
      } as AnyTableFilter,
    })
    if (!job) {
      return false
    }

    await this.db
      .update(this.model)
      .set({ processAt: new Date(), status: "pending" })
      .where(eq(this.model.id, id))
    return true
  }

  async deleteJob(id: string): Promise<boolean> {
    const results = await this.db
      .delete(this.model)
      .where(
        and(eq(this.model.id, id), eq(this.model.queueName, this.queueName))
      )
      .returning()
    return results.length > 0
  }

  async setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean> {
    const job = await this.queryTable.findFirst({
      where: {
        id: { eq: id },
        queueName: { eq: this.queueName },
      } as AnyTableFilter,
    })
    if (!job) {
      return false
    }
    const existing = (job as schema.QueueJob).signals as Record<
      string,
      unknown
    > | null
    const signals = { ...existing, [event]: data }
    await this.db
      .update(this.model)
      .set({ processAt: new Date(), signals, status: "pending" })
      .where(eq(this.model.id, id))
    return true
  }

  // eslint-disable-next-line class-methods-use-this -- property mapping
  private transformJob(job: schema.QueueJob): Job {
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
      payload: job.payload,
      priority: job.priority,
      processAt: job.processAt,
      processedAt: job.processedAt ?? undefined,
      progress: job.progress ?? 0,
      repeatCount: job.repeatCount ?? 0,
      repeatEvery: job.repeatEvery ?? undefined,
      repeatLimit: job.repeatLimit ?? undefined,
      result: job.result ?? undefined,
      signals: job.signals as Readonly<Record<string, unknown>> | undefined,
      status: job.status as JobStatus,
      steps: job.steps as StepState[] | undefined,
      timeout: job.timeout ?? undefined,
      uniqueKey: job.uniqueKey ?? undefined,
    }
  }

  // eslint-disable-next-line class-methods-use-this -- property mapping
  private transformFlowNode(row: flowSchema.QueueFlow): FlowNode {
    return {
      id: row.id,
      flowId: row.flowId,
      parentNodeId: row.parentNodeId ?? undefined,
      jobId: row.jobId ?? undefined,
      queueName: row.queueName,
      name: row.name,
      payload: row.payload,
      options: row.options as FlowNode["options"],
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
    const flowModel = this.requireFlowModel()
    return this.db.transaction(async (tx) => {
      // Insert all flow nodes with pre-generated IDs
      const insertedNodes = await tx
        .insert(flowModel)
        .values(
          nodes.map((n) => ({
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
          }))
        )
        .returning()

      // Insert leaf jobs and correlate with their flow nodes
      for (const job of leafJobs) {
        // Find the corresponding flow node to get queueName
        const matchingNode = nodes.find((n) => n.id === job.flowNodeId)
        const [createdJob] = await tx
          .insert(this.model)
          .values({
            attempts: job.attempts,
            cron: job.cron ?? null,
            flowNodeId: job.flowNodeId ?? null,
            groupKey: job.groupKey ?? null,
            maxAttempts: job.maxAttempts,
            name: job.name,
            payload: job.payload,
            priority: job.priority,
            processAt: sql`${job.processAt.toISOString()}::timestamptz`,
            progress: job.progress ?? 0,
            queueName: matchingNode?.queueName ?? this.queueName,
            repeatCount: job.repeatCount ?? 0,
            repeatEvery: job.repeatEvery ?? null,
            repeatLimit: job.repeatLimit ?? null,
            status: job.status,
            timeout: typeof job.timeout === "number" ? job.timeout : null,
            uniqueKey: job.uniqueKey ?? null,
          })
          .returning()

        // Update the flow node with the created job ID
        if (createdJob && job.flowNodeId) {
          await tx
            .update(flowModel)
            .set({ jobId: createdJob.id })
            .where(eq(flowModel.id, job.flowNodeId))
        }
      }

      // Re-fetch nodes to get the updated jobId values
      const finalNodes = await tx
        .select()
        .from(flowModel)
        .where(
          inArray(
            flowModel.id,
            insertedNodes.map((n) => n.id)
          )
        )

      return finalNodes.map((row) =>
        this.transformFlowNode(row as flowSchema.QueueFlow)
      )
    })
  }

  async getFlowNode(nodeId: string): Promise<FlowNode | null> {
    const flowModel = this.requireFlowModel()
    const [row] = await this.db
      .select()
      .from(flowModel)
      .where(eq(flowModel.id, nodeId))
      .limit(1)

    return row ? this.transformFlowNode(row as flowSchema.QueueFlow) : null
  }

  async getFlowTree(flowId: string): Promise<FlowTree | null> {
    const flowModel = this.requireFlowModel()
    const rows = await this.db
      .select()
      .from(flowModel)
      .where(eq(flowModel.flowId, flowId))

    if (rows.length === 0) {
      return null
    }

    const allNodes = rows.map((r) =>
      this.transformFlowNode(r as flowSchema.QueueFlow)
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
    const flowModel = this.requireFlowModel()
    const conditions = [sql`${flowModel.parentNodeId} IS NULL`]

    if (options?.status) {
      conditions.push(eq(flowModel.status, options.status))
    }

    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const rows = await this.db
      .select()
      .from(flowModel)
      .where(and(...conditions))
      .orderBy(desc(flowModel.createdAt))
      .limit(limit)
      .offset(offset)

    return rows.map((r) => {
      const node = this.transformFlowNode(r as flowSchema.QueueFlow)
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
    const flowModel = this.requireFlowModel()
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

    await this.db.update(flowModel).set(updates).where(eq(flowModel.id, nodeId))
  }

  async incrementNodeChildrenCompleted(
    nodeId: string
  ): Promise<{ completed: number; total: number }> {
    const flowModel = this.requireFlowModel()
    await this.db
      .update(flowModel)
      .set({
        childrenCompleted: sql`${flowModel.childrenCompleted} + 1`,
      })
      .where(eq(flowModel.id, nodeId))

    const [updated] = await this.db
      .select({
        childrenCompleted: flowModel.childrenCompleted,
        childrenCount: flowModel.childrenCount,
      })
      .from(flowModel)
      .where(eq(flowModel.id, nodeId))
      .limit(1)

    if (!updated) {
      return { completed: 0, total: 0 }
    }

    return {
      completed: updated.childrenCompleted,
      total: updated.childrenCount,
    }
  }

  async getNodeChildren(nodeId: string): Promise<readonly FlowNode[]> {
    const flowModel = this.requireFlowModel()
    const rows = await this.db
      .select()
      .from(flowModel)
      .where(eq(flowModel.parentNodeId, nodeId))

    return rows.map((r) => this.transformFlowNode(r as flowSchema.QueueFlow))
  }

  async getChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const flowModel = this.requireFlowModel()
    const rows = await this.db
      .select()
      .from(flowModel)
      .where(
        and(
          eq(flowModel.parentNodeId, nodeId),
          eq(flowModel.status, "completed")
        )
      )

    const results = new Map<string, unknown>()
    for (const row of rows) {
      results.set(row.id, row.result)
    }
    return results
  }

  async getFailedChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>> {
    const flowModel = this.requireFlowModel()
    const rows = await this.db
      .select()
      .from(flowModel)
      .where(
        and(eq(flowModel.parentNodeId, nodeId), eq(flowModel.status, "failed"))
      )

    const results = new Map<string, unknown>()
    for (const row of rows) {
      results.set(row.id, row.error)
    }
    return results
  }

  async cancelUnprocessedChildren(nodeId: string): Promise<number> {
    const flowModel = this.requireFlowModel()
    // Get all child nodes
    const children = await this.db
      .select()
      .from(flowModel)
      .where(eq(flowModel.parentNodeId, nodeId))

    let cancelled = 0
    const now = new Date()

    for (const child of children) {
      const typedChild = child as flowSchema.QueueFlow
      // Cancel waiting nodes (no job yet)
      if (typedChild.status === "waiting") {
        await this.db
          .update(flowModel)
          .set({ status: "cancelled", completedAt: now })
          .where(eq(flowModel.id, typedChild.id))
        cancelled++
        // Recursively cancel subtree
        cancelled += await this.cancelUnprocessedChildren(typedChild.id)
      } else if (typedChild.status === "ready" && typedChild.jobId) {
        // Cancel the corresponding job if it's still pending/delayed
        const result = await this.db
          .update(this.model)
          .set({
            cancelledAt: now,
            status: "cancelled",
          })
          .where(
            and(
              eq(this.model.id, typedChild.jobId),
              inArray(this.model.status, ["pending", "delayed"])
            )
          )
          .returning()

        if (result.length > 0) {
          await this.db
            .update(flowModel)
            .set({ status: "cancelled", completedAt: now })
            .where(eq(flowModel.id, typedChild.id))
          cancelled++
        }
        // Recursively cancel subtree
        cancelled += await this.cancelUnprocessedChildren(typedChild.id)
      }
    }

    return cancelled
  }

  async deleteFlow(flowId: string): Promise<number> {
    const flowModel = this.requireFlowModel()
    const deleted = await this.db
      .delete(flowModel)
      .where(eq(flowModel.flowId, flowId))
      .returning()
    return deleted.length
  }

  async cleanupFlows(keepCount: number): Promise<number> {
    const flowModel = this.requireFlowModel()
    // Find root nodes of completed flows, ordered by creation time
    const rootNodes = await this.db
      .select({ flowId: flowModel.flowId })
      .from(flowModel)
      .where(
        and(
          sql`${flowModel.parentNodeId} IS NULL`,
          eq(flowModel.status, "completed")
        )
      )
      .orderBy(desc(flowModel.createdAt))
      .offset(keepCount)

    if (rootNodes.length === 0) {
      return 0
    }

    const flowIdsToDelete = rootNodes.map((r) => r.flowId)

    const deleted = await this.db
      .delete(flowModel)
      .where(inArray(flowModel.flowId, flowIdsToDelete))
      .returning()

    return deleted.length
  }
}
