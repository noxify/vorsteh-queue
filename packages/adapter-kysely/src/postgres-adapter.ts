import type { Kysely } from "kysely"
import { sql } from "kysely"

import type {
  AdapterProps,
  BaseJob,
  BatchJob,
  JobStatus,
  QueueStats,
  SerializedError,
} from "@vorsteh-queue/core"
import { asUtc, BaseQueueAdapter, serializeError } from "@vorsteh-queue/core"

import type { DB, InsertQueueJobValue, QueueJob } from "./types"

/**
 * PostgreSQL adapter for the queue system using Drizzle ORM.
 * Supports PostgreSQL databases through Drizzle ORM with node-postgres, postgres.js, or PGlite.
 * Provides persistent job storage with ACID transactions and optimized job selection.
 *
 * @example
 * ```typescript
 * import { Kysely } from "kysely"
 * import { PostgresJSDialect } from "kysely-postgres-js"
 * import postgres from "postgres"
 *
 * import type { QueueJobTableDefinition } from "@vorsteh-queue/adapter-kysely/types"
 *
 * import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-kysely"
 * import { Queue } from "@vorsteh-queue/core"
 *
 * interface DB {
 *   queue_jobs: QueueJobTableDefinition
 *   other_table: {
 *     name: string
 *   }
 * }
 *
 * const client = postgres(
 *   process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/queue_db",
 *   { max: 10 }, // Connection pool
 * )
 *
 * const db = new Kysely<DB>({
 *   dialect: new PostgresJSDialect({
 *     postgres: client,
 *   }),
 * })
 *
 *
 * const queue = new Queue(new PostgresQueueAdapter(db), {
 *   name: "advanced-queue",
 *   removeOnComplete: 20,
 *   removeOnFail: 10,
 * })
 * ```
 */
export class PostgresQueueAdapter extends BaseQueueAdapter {
  private customDbClient: Kysely<DB>
  private tableName: string
  private schemaName: string

  /**
   * Create a new PostgreSQL queue adapter.
   *
   * @param db Kysely database instance
   */
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: Kysely<any>,
    adapterConfig?: AdapterProps<"kysely">,
  ) {
    super()

    // to get the type-safety, we cast the db to Kysely<DB>
    this.customDbClient = db as Kysely<DB>
    this.tableName = adapterConfig?.tableName ?? "queue_jobs"
    this.schemaName = adapterConfig?.schemaName ?? "public"
  }

  async connect(): Promise<void> {
    // kysely doesn't require explicit connection
  }

  async disconnect(): Promise<void> {
    // Releases all resources and disconnects from the database.

    await this.customDbClient.destroy()
  }

  async addJob<TJobPayload, TJobResult = unknown>(
    job: Omit<BaseJob<TJobPayload, TJobResult>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload, TJobResult>> {
    const result = await this.customDbClient
      // this is needed to convince kysely's type system that the table name is correct
      // we cast to unknown and then to "tablename" to bypass the string literal type check
      // I know, it's a bit hacky, but it works
      // tried it also via `sql.id()` but that didn't work and I got some runtime errors
      // we're doing this in all places where we reference the table name dynamically
      .insertInto(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .values({
        queue_name: this.queueName,
        name: job.name,
        payload: job.payload,
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        max_attempts: job.maxAttempts,
        process_at: sql`${job.processAt.toISOString()}::timestamptz`,
        cron: job.cron,
        repeat_every: job.repeatEvery,
        repeat_limit: job.repeatLimit,
        repeat_count: job.repeatCount,
        timeout: job.timeout,
      })
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error("Failed to create job")
    }

    return this.transformJob(result) as BaseJob<TJobPayload, TJobResult>
  }

  async addJobs<TJobPayload, TJobResult = unknown>(
    jobs: Omit<BatchJob<TJobPayload, TJobResult>, "id" | "createdAt">[],
  ): Promise<BatchJob<TJobPayload, TJobResult>[]> {
    if (!jobs.length) return []

    const values: InsertQueueJobValue[] = jobs.map((job) => ({
      queue_name: this.queueName,
      name: job.name,
      payload: job.payload,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      max_attempts: job.maxAttempts,
      process_at: sql`${asUtc(new Date()).toISOString()}::timestamptz`,
      cron: null,
      repeat_every: null,
      repeat_limit: null,
      repeat_count: 0,
      timeout: job.timeout,
    }))

    const results = await this.customDbClient
      .insertInto(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .values(values)
      .returningAll()
      .execute()

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
    if (status === "processing") updates.processed_at = asUtc(now)
    if (status === "completed") updates.completed_at = asUtc(now)
    if (status === "failed") updates.failed_at = asUtc(now)

    await this.customDbClient
      .updateTable(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .set(updates)
      .where("id", "=", id)
      .execute()
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.customDbClient
      .updateTable(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .set({ attempts: sql`${"attempts"} + 1` })
      .where("id", "=", id)
      .execute()
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    // Ensure progress is between 0-100
    const normalizedProgress = Math.max(0, Math.min(100, progress))

    await this.customDbClient
      .updateTable(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .set({ progress: normalizedProgress })
      .where("id", "=", id)
      .execute()
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .select(({ fn }) => [
        "status",
        // The `fn` module contains the most common functions.
        fn.countAll<number>().as("count"),
      ])
      .where("queue_name", "=", this.queueName)
      .groupBy("status")
      .execute()

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

  async getQueueJobs(): Promise<BaseJob[]> {
    const jobs = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .execute()

    return jobs.map((job) => this.transformJob(job))
  }

  async getJobDetails(id: string): Promise<BaseJob> {
    const job = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("id", "=", id)
      .executeTakeFirst()

    if (!job) {
      throw new Error(`Job with ID ${id} not found in queue ${this.queueName}`)
    }
    return this.transformJob(job)
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const query = this.customDbClient
      .deleteFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .where("queue_name", "=", this.queueName)

    if (status) {
      query.where("status", "=", status)
    }

    // const result = (await this.customDbClient
    //   .delete(schema.queueJobs)
    const result = await query.executeTakeFirst()

    return Number(result.numDeletedRows)
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    // Get jobs to delete (all except the most recent N)
    const jobsToDelete = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .select("id")
      .where("queue_name", "=", this.queueName)
      .where("status", "=", status)
      .orderBy("created_at", "desc")
      .offset(keepCount)
      .execute()

    if (jobsToDelete.length === 0) {
      return 0
    }

    const idsToDelete = jobsToDelete.map((job) => job.id)

    const result = await this.customDbClient
      .deleteFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .where("queue_name", "=", this.queueName)
      .where("id", "in", idsToDelete)
      .executeTakeFirst()

    return Number(result)
  }

  async size(): Promise<number> {
    const result = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .select(this.customDbClient.fn.count("id").as("count"))
      .executeTakeFirst()

    return Number(result?.count ?? 0)
  }

  async getNextJobsForHandler(handlerName: string, count: number) {
    const jobs = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "pending")
      .where("name", "=", handlerName)
      .orderBy("priority", "asc")
      .orderBy("created_at", "asc")
      .limit(count)
      .forUpdate()
      .skipLocked()
      .execute()

    // BatchJob omits scheduling fields, so we strip them
    return jobs.map((job) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cron, repeat_every, repeat_limit, repeat_count, process_at, status, ...rest } = job
      return {
        ...rest,
        status: status as JobStatus,
        maxAttempts: job.max_attempts,
        createdAt: job.created_at,
        processAt: job.process_at,
        processedAt: job.processed_at ?? undefined,
        completedAt: job.completed_at ?? undefined,
        failedAt: job.failed_at ?? undefined,
        error: job.error as SerializedError | undefined,
        result: job.result,
        progress: job.progress ?? 0,
        timeout: job.timeout ?? undefined,
      }
    })
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.customDbClient.transaction().execute(async () => fn())
  }

  protected async getDelayedJobReady(now: Date): Promise<BaseJob | null> {
    const job = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "delayed")
      .where("process_at", "<=", now)
      .orderBy("priority", "asc")
      .orderBy("created_at", "asc")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst()

    return job ? this.transformJob(job) : null
  }

  protected async getPendingJobByPriority(): Promise<BaseJob | null> {
    const job = await this.customDbClient
      .selectFrom(`${this.schemaName}.${this.tableName}` as unknown as "tablename")
      .selectAll()
      .where("queue_name", "=", this.queueName)
      .where("status", "=", "pending")
      .orderBy("priority", "asc")
      .orderBy("created_at", "asc")
      .limit(1)
      .forUpdate()
      .skipLocked()
      .executeTakeFirst()

    return job ? this.transformJob(job) : null
  }

  private transformJob(job: QueueJob): BaseJob {
    return {
      id: job.id,
      name: job.name,
      payload: job.payload,
      status: job.status as JobStatus,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      createdAt: job.created_at,
      processAt: job.process_at,
      processedAt: job.processed_at ?? undefined,
      completedAt: job.completed_at ?? undefined,
      failedAt: job.failed_at ?? undefined,
      error: job.error as SerializedError | undefined,
      result: job.result,
      progress: job.progress ?? 0,
      cron: job.cron ?? undefined,
      repeatEvery: job.repeat_every ?? undefined,
      repeatLimit: job.repeat_limit ?? undefined,
      repeatCount: job.repeat_count ?? 0,
      timeout: job.timeout as number | false | undefined,
    }
  }
}
