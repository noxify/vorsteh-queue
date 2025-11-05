import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PgTable } from "drizzle-orm/pg-core"
import type { PgliteDatabase } from "drizzle-orm/pglite"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { and, asc, count, eq, lte, sql } from "drizzle-orm"

import type {
  AdapterProps,
  BaseJob,
  BatchJob,
  JobStatus,
  QueueStats,
  SerializedError,
} from "@vorsteh-queue/core"
import { asUtc, BaseQueueAdapter, serializeError } from "@vorsteh-queue/core"

import type * as schema from "./postgres-schema"

type FullSchema = typeof schema

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DrizzleDatabase = NodePgDatabase<any> | PostgresJsDatabase<any> | PgliteDatabase<any>

function getModelByModelName<TModel extends Record<string, PgTable>, TDb extends DrizzleDatabase>(
  db: TDb,
  modelName: keyof TModel,
) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const model = db._.fullSchema[modelName]
  if (!model) {
    throw new Error(`Model with name ${String(modelName)} not found in database schema`)
  }

  // to keep the type-safety internally, we're set the type manually
  // this has no impact on runtime, but helps while developing/customizing the adapter
  return model as FullSchema["queueJobs"]
}
/**
 * PostgreSQL adapter for the queue system using Drizzle ORM.
 * Supports PostgreSQL databases through Drizzle ORM with node-postgres, postgres.js, or PGlite.
 * Provides persistent job storage with ACID transactions and optimized job selection.
 *
 * @example
 * ```typescript
 * import { drizzle } from "drizzle-orm/node-postgres"
 * import { Pool } from "pg"
 *
 * const pool = new Pool({ connectionString: "postgresql://..." })
 * const db = drizzle(pool)
 * const adapter = new PostgresQueueAdapter(db)
 * const queue = new Queue(adapter, { name: "my-queue" })
 * ```
 */
export class PostgresQueueAdapter<
  TDb extends DrizzleDatabase = DrizzleDatabase,
> extends BaseQueueAdapter {
  private db: TDb

  private model: ReturnType<typeof getModelByModelName>
  /**
   * Create a new PostgreSQL queue adapter.
   *
   * @param db Drizzle PostgreSQL database instance
   */
  constructor(db: TDb, adapterConfig?: AdapterProps<"drizzle">) {
    super()

    this.db = db

    // Get the model based on the provided model name
    this.model = getModelByModelName(db, adapterConfig?.modelName ?? "queueJobs")
  }

  async connect(): Promise<void> {
    // Drizzle doesn't require explicit connection
  }

  async disconnect(): Promise<void> {
    // Drizzle doesn't require explicit disconnection
  }

  async addJob<TJobPayload, TJobResult = unknown>(
    job: Omit<BaseJob<TJobPayload, TJobResult>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload, TJobResult>> {
    const [result] = (await this.db
      .insert(this.model)
      .values({
        queueName: this.queueName,
        name: job.name,
        payload: job.payload,
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        processAt: sql`${job.processAt.toISOString()}::timestamptz`,
        cron: job.cron,
        repeatEvery: job.repeatEvery,
        repeatLimit: job.repeatLimit,
        repeatCount: job.repeatCount,
        timeout: job.timeout,
      })
      .returning()) as [schema.QueueJob | undefined]

    if (!result) {
      throw new Error("Failed to create job")
    }

    return this.transformJob(result) as BaseJob<TJobPayload, TJobResult>
  }

  async addJobs<TJobPayload, TJobResult = unknown>(
    jobs: Omit<BatchJob<TJobPayload, TJobResult>, "id" | "createdAt">[],
  ): Promise<BatchJob<TJobPayload, TJobResult>[]> {
    if (!jobs.length) return []
    const values = jobs.map((job) => ({
      queueName: this.queueName,
      name: job.name,
      payload: job.payload,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      timeout: job.timeout,
      processAt: sql`${asUtc(new Date()).toISOString()}::timestamptz`,
      cron: null,
      repeatEvery: null,
      repeatLimit: null,
      repeatCount: 0,
    }))
    const results = await this.db.insert(this.model).values(values).returning()
    if (!results.length) {
      throw new Error("Failed to create jobs")
    }
    return results.map((row) => this.transformJob(row) as BatchJob<TJobPayload, TJobResult>)
  }

  async updateJobStatus(
    id: string,
    status: JobStatus,
    error?: unknown,
    result?: unknown,
  ): Promise<void> {
    const now = new Date()
    const updates: Record<string, unknown> = { status }

    if (error) updates.error = serializeError(error)
    if (result !== undefined) updates.result = result
    if (status === "processing") updates.processedAt = asUtc(now)
    if (status === "completed") updates.completedAt = asUtc(now)
    if (status === "failed") updates.failedAt = asUtc(now)

    await this.db.update(this.model).set(updates).where(eq(this.model.id, id))
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.db
      .update(this.model)
      .set({ attempts: sql`${this.model.attempts} + 1` })

      .where(eq(this.model.id, id))
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    // Ensure progress is between 0-100
    const normalizedProgress = Math.max(0, Math.min(100, progress))

    await this.db
      .update(this.model)
      .set({ progress: normalizedProgress })

      .where(eq(this.model.id, id))
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.db
      .select({
        status: this.model.status,
        count: count(),
      })
      .from(this.model)

      .where(eq(this.model.queueName, this.queueName))

      .groupBy(this.model.status)

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }

    for (const stat of stats) {
      result[stat.status as JobStatus] = Number(stat.count)
    }

    return result
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const conditions = [eq(this.model.queueName, this.queueName)]
    if (status) {
      conditions.push(eq(this.model.status, status))
    }

    // Define the expected return type from delete operation
    interface DeleteResult {
      rowCount: number
    }

    const result = (await this.db.delete(this.model).where(and(...conditions))) as DeleteResult

    return result.rowCount
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    // Get jobs to delete (all except the most recent N)
    const jobsToDelete = await this.db

      .select({ id: this.model.id })
      .from(this.model)

      .where(and(eq(this.model.queueName, this.queueName), eq(this.model.status, status)))
      .orderBy(sql`${this.model.createdAt} DESC`)
      .offset(keepCount)

    if (jobsToDelete.length === 0) {
      return 0
    }

    const idsToDelete = jobsToDelete.map((job) => job.id)

    interface DeleteResult {
      rowCount: number
    }

    const result = (await this.db
      .delete(this.model)
      .where(
        and(eq(this.model.queueName, this.queueName), sql`${this.model.id} = ANY(${idsToDelete})`),
      )) as DeleteResult

    return result.rowCount
  }

  async size(): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(this.model)

      .where(and(eq(this.model.queueName, this.queueName), eq(this.model.status, "pending")))

    return Number(result?.count ?? 0)
  }

  async getNextJobsForHandler(handlerName: string, count: number) {
    const jobs = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),

          eq(this.model.status, "pending"),

          eq(this.model.name, handlerName),
        ),
      )

      .orderBy(asc(this.model.priority), asc(this.model.createdAt))
      .limit(count)
      .for("update", { skipLocked: true })

    // BatchJob omits scheduling fields, so we strip them
    return jobs.map((job) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cron, repeatEvery, repeatLimit, repeatCount, processAt, ...rest } = this.transformJob(
        job as schema.QueueJob,
      )
      return rest
    })
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.db.transaction(async () => fn())
  }

  protected async getDelayedJobReady(now: Date): Promise<BaseJob | null> {
    const [job] = await this.db
      .select()
      .from(this.model)
      .where(
        and(
          eq(this.model.queueName, this.queueName),

          eq(this.model.status, "delayed"),

          lte(this.model.processAt, now),
        ),
      )

      .orderBy(asc(this.model.priority), asc(this.model.createdAt))
      .limit(1)
      .for("update", { skipLocked: true })

    return job ? this.transformJob(job as schema.QueueJob) : null
  }

  protected async getPendingJobByPriority(): Promise<BaseJob | null> {
    const [job] = await this.db
      .select()
      .from(this.model)

      .where(and(eq(this.model.queueName, this.queueName), eq(this.model.status, "pending")))

      .orderBy(asc(this.model.priority), asc(this.model.createdAt))
      .limit(1)
      .for("update", { skipLocked: true })

    return job ? this.transformJob(job as schema.QueueJob) : null
  }

  private transformJob(job: schema.QueueJob): BaseJob {
    return {
      id: job.id,
      name: job.name,
      payload: job.payload,
      status: job.status as JobStatus,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      processAt: job.processAt,
      processedAt: job.processedAt ?? undefined,
      completedAt: job.completedAt ?? undefined,
      failedAt: job.failedAt ?? undefined,
      error: job.error as SerializedError | undefined,
      result: job.result,
      progress: job.progress ?? 0,
      cron: job.cron ?? undefined,
      repeatEvery: job.repeatEvery ?? undefined,
      repeatLimit: job.repeatLimit ?? undefined,
      repeatCount: job.repeatCount ?? 0,
      timeout: job.timeout as number | false | undefined,
    }
  }
}
