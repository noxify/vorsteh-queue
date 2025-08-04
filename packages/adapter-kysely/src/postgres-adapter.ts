import type { Kysely } from "kysely"
import { sql } from "kysely"

import type { BaseJob, JobStatus, QueueStats, SerializedError } from "@vorsteh-queue/core"
import { asUtc, BaseQueueAdapter, serializeError } from "@vorsteh-queue/core"

import type { DB, QueueJob } from "./types"

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
export class PostgresQueueAdapter extends BaseQueueAdapter {
  /**
   * Create a new PostgreSQL queue adapter.
   *
   * @param db Kysely database instance
   */
  constructor(private readonly db: Kysely<DB>) {
    super()
  }

  async connect(): Promise<void> {
    // kysely doesn't require explicit connection
    // TODO: check if `this.db.connection()` should be used here
  }

  async disconnect(): Promise<void> {
    // Releases all resources and disconnects from the database.

    await this.db.destroy()
  }

  async addJob<TJobPayload, TJobResult = unknown>(
    job: Omit<BaseJob<TJobPayload, TJobResult>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload, TJobResult>> {
    const result = await this.db
      .insertInto("queue_jobs")
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

    await this.db.updateTable("queue_jobs").set(updates).where("id", "=", id).execute()
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.db
      .updateTable("queue_jobs")
      .set({ attempts: sql`${"attempts"} + 1` })
      .where("id", "=", id)
      .execute()
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    // Ensure progress is between 0-100
    const normalizedProgress = Math.max(0, Math.min(100, progress))

    await this.db
      .updateTable("queue_jobs")
      .set({ progress: normalizedProgress })
      .where("id", "=", id)
      .execute()
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.db
      .selectFrom("queue_jobs")
      .select(({ fn }) => [
        "status",

        // The `fn` module contains the most common
        // functions.
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

  async clearJobs(status?: JobStatus): Promise<number> {
    const query = this.db.deleteFrom("queue_jobs").where("queue_name", "=", this.queueName)

    if (status) {
      query.where("status", "=", status)
    }

    // const result = (await this.db
    //   .delete(schema.queueJobs)
    const result = await query.executeTakeFirst()

    return Number(result.numDeletedRows)
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    // Get jobs to delete (all except the most recent N)
    const jobsToDelete = await this.db
      .selectFrom("queue_jobs")
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

    const result = await this.db
      .deleteFrom("queue_jobs")
      .where("queue_name", "=", this.queueName)
      .where("id", "in", idsToDelete)
      .executeTakeFirst()

    return Number(result)
  }

  async size(): Promise<number> {
    const result = await this.db
      .selectFrom("queue_jobs")
      .select(this.db.fn.count("id").as("count"))
      .executeTakeFirst()

    return Number(result?.count ?? 0)
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.db.transaction().execute(async () => fn())
  }

  protected async getDelayedJobReady(now: Date): Promise<BaseJob | null> {
    const job = await this.db
      .selectFrom("queue_jobs")
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
    const job = await this.db
      .selectFrom("queue_jobs")
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
