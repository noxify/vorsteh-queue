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
import { and, asc, count, eq, inArray, lte, not, sql } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PgTable } from "drizzle-orm/pg-core"
import type { PgliteDatabase } from "drizzle-orm/pglite"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type * as schema from "./postgres-schema"

type FullSchema = typeof schema

type DrizzleDatabase =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | NodePgDatabase<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | PostgresJsDatabase<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | PgliteDatabase<any>

function getModelByModelName<
  TModel extends Record<string, PgTable>,
  TDb extends DrizzleDatabase,
>(db: TDb, modelName: keyof TModel) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  const model = (db as any)._.fullSchema[modelName]
  if (!model) {
    throw new Error(
      `Model with name ${String(modelName)} not found in database schema`
    )
  }
  return model as FullSchema["queueJobs"]
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
export class PostgresQueueAdapter<
  TDb extends DrizzleDatabase = DrizzleDatabase,
> extends BaseQueueAdapter {
  private db: TDb
  private model: ReturnType<typeof getModelByModelName>

  constructor(db: TDb, adapterConfig?: AdapterProps<"drizzle">) {
    super()
    this.db = db
    this.model = getModelByModelName(
      db,
      adapterConfig?.modelName ?? "queueJobs"
    )
  }

  // eslint-disable-next-line class-methods-use-this, no-empty-function
  async connect(): Promise<void> {}
  // eslint-disable-next-line class-methods-use-this, no-empty-function
  async disconnect(): Promise<void> {}

  async addJob(job: NewJob): Promise<Job> {
    const [result] = await this.db
      .insert(this.model)
      .values({
        attempts: job.attempts,
        cron: job.cron ?? null,
        dependsOn: job.dependsOn ? JSON.stringify(job.dependsOn) : null,
        groupKey: job.groupKey ?? null,
        maxAttempts: job.maxAttempts,
        name: job.name,
        onDependencyFailure: job.onDependencyFailure ?? null,
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
      dependsOn: job.dependsOn ? JSON.stringify(job.dependsOn) : null,
      groupKey: job.groupKey ?? null,
      maxAttempts: job.maxAttempts,
      name: job.name,
      onDependencyFailure: job.onDependencyFailure ?? null,
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
    const [job] = await this.db
      .select()
      .from(this.model)
      .where(
        and(eq(this.model.id, id), eq(this.model.queueName, this.queueName))
      )
      .limit(1)

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
          inArray(this.model.name, [...options.handlerNames])
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
    const [job] = await this.db
      .select()
      .from(this.model)
      .where(
        and(eq(this.model.id, id), eq(this.model.queueName, this.queueName))
      )
      .limit(1)

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

    const jobs = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          eq(this.model.status, "dead")
        )
      )
      .orderBy(sql`${this.model.createdAt} DESC`)
      .limit(limit)
      .offset(offset)

    return jobs.map((row) => this.transformJob(row as schema.QueueJob))
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
      "waiting-children": 0,
    }
    for (const stat of stats) {
      if (stat.status in result) {
        result[stat.status as keyof typeof result] = Number(stat.count)
      }
    }
    return result
  }

  async size(): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          inArray(this.model.status, ["pending", "delayed"])
        )
      )
    return Number(result?.count ?? 0)
  }

  async getJobs(options: {
    status?: JobStatus
    name?: string
    limit?: number
    offset?: number
  }): Promise<readonly Job[]> {
    const limit = options.limit ?? 20
    const offset = options.offset ?? 0
    const conditions = [eq(this.model.queueName, this.queueName)]

    if (options.status) {
      conditions.push(eq(this.model.status, options.status))
    }
    if (options.name) {
      conditions.push(eq(this.model.name, options.name))
    }

    const jobs = await this.db
      .select()
      .from(this.model)
      .where(and(...conditions))
      .orderBy(sql`${this.model.createdAt} DESC`)
      .limit(limit)
      .offset(offset)

    return jobs.map((row) => this.transformJob(row as schema.QueueJob))
  }

  async getFlows(
    options?: PaginationOptions
  ): Promise<readonly { flowId: string; rootJob: Job }[]> {
    const limit = options?.limit ?? 20
    const offset = options?.offset ?? 0

    const jobs = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          sql`${this.model.flowId} IS NOT NULL`,
          sql`${this.model.parentId} IS NULL`
        )
      )
      .orderBy(sql`${this.model.createdAt} DESC`)
      .limit(limit)
      .offset(offset)

    return jobs.map((row) => {
      const job = this.transformJob(row as schema.QueueJob)
      // oxlint-disable-next-line typescript/no-non-null-assertion
      return { flowId: job.flowId!, rootJob: job }
    })
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

    const [job] = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          eq(this.model.uniqueKey, uniqueKey),
          not(inArray(this.model.status, terminalStatuses))
        )
      )
      .limit(1)

    return job ? this.transformJob(job as schema.QueueJob) : null
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.db.transaction(async () => fn())
  }

  async updateJobSteps(id: string, steps: readonly StepState[]): Promise<void> {
    await this.db.update(this.model).set({ steps }).where(eq(this.model.id, id))
  }

  async retryJob(id: string): Promise<boolean> {
    const [job] = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.id, id),
          eq(this.model.queueName, this.queueName),
          eq(this.model.status, "failed")
        )
      )
      .limit(1)
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
    const [job] = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.id, id),
          eq(this.model.queueName, this.queueName),
          eq(this.model.status, "delayed")
        )
      )
      .limit(1)
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
    const [job] = await this.db
      .select()
      .from(this.model)
      .where(
        and(eq(this.model.id, id), eq(this.model.queueName, this.queueName))
      )
      .limit(1)
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

  async getFlowTree(flowId: string): Promise<FlowNode | null> {
    const jobs = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          eq(this.model.flowId, flowId)
        )
      )
    if (jobs.length === 0) {
      return null
    }

    const allJobs = jobs.map((j) => this.transformJob(j as schema.QueueJob))
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

  async incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }> {
    await this.db
      .update(this.model)
      .set({ childrenCompleted: sql`${this.model.childrenCompleted} + 1` })
      .where(eq(this.model.id, parentId))
    const [updated] = await this.db
      .select()
      .from(this.model)
      .where(eq(this.model.id, parentId))
      .limit(1)
    if (!updated) {
      return { completed: 0, total: 0 }
    }
    const j = updated as schema.QueueJob
    return { completed: j.childrenCompleted, total: j.childrenCount }
  }

  async getChildrenJobs(parentId: string): Promise<readonly Job[]> {
    const jobs = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),
          eq(this.model.parentId, parentId)
        )
      )
    return jobs.map((j) => this.transformJob(j as schema.QueueJob))
  }

  // eslint-disable-next-line class-methods-use-this -- property mapping, not logical complexity
  // oxlint-disable-next-line complexity, class-methods-use-this
  private transformJob(job: schema.QueueJob): Job {
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
      failParentOnFailure: (job.failParentOnFailure ?? 0) > 0,
      failedAt: job.failedAt ?? undefined,
      flowId: job.flowId ?? undefined,
      groupKey: job.groupKey ?? undefined,
      id: job.id,
      maxAttempts: job.maxAttempts,
      name: job.name,
      onDependencyFailure:
        (job.onDependencyFailure as "fail" | "cancel") ?? undefined,
      parentId: job.parentId ?? undefined,
      payload: job.payload,
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
}
