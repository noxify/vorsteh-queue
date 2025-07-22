import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type { PgliteDatabase } from "drizzle-orm/pglite"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { and, asc, count, eq, lte, sql } from "drizzle-orm"

import type { BaseJob, JobStatus, QueueStats, SerializedError } from "@vorsteh-queue/core"
import { asUtc, BaseQueueAdapter, serializeError } from "@vorsteh-queue/core"

import * as schema from "./postgres-schema"

type DrizzleDatabase =
  | NodePgDatabase<typeof schema>
  | PostgresJsDatabase<typeof schema>
  | PgliteDatabase<typeof schema>

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
   * @param db - Drizzle PostgreSQL database instance
   */
  constructor(private readonly db: DrizzleDatabase) {
    super()
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
    const [result] = await this.db
      .insert(schema.queueJobs)
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
      .returning()

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
    if (status === "processing") updates.processedAt = asUtc(now)
    if (status === "completed") updates.completedAt = asUtc(now)
    if (status === "failed") updates.failedAt = asUtc(now)

    await this.db.update(schema.queueJobs).set(updates).where(eq(schema.queueJobs.id, id))
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.db
      .update(schema.queueJobs)
      .set({ attempts: sql`${schema.queueJobs.attempts} + 1` })
      .where(eq(schema.queueJobs.id, id))
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    // Ensure progress is between 0-100
    const normalizedProgress = Math.max(0, Math.min(100, progress))

    await this.db
      .update(schema.queueJobs)
      .set({ progress: normalizedProgress })
      .where(eq(schema.queueJobs.id, id))
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.db
      .select({
        status: schema.queueJobs.status,
        count: count(),
      })
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.queueName, this.queueName))
      .groupBy(schema.queueJobs.status)

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
    const conditions = [eq(schema.queueJobs.queueName, this.queueName)]
    if (status) {
      conditions.push(eq(schema.queueJobs.status, status))
    }

    // Define the expected return type from delete operation
    interface DeleteResult {
      rowCount: number
    }

    const result = (await this.db
      .delete(schema.queueJobs)
      .where(and(...conditions))) as DeleteResult

    return result.rowCount
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    // Get jobs to delete (all except the most recent N)
    const jobsToDelete = await this.db
      .select({ id: schema.queueJobs.id })
      .from(schema.queueJobs)
      .where(
        and(eq(schema.queueJobs.queueName, this.queueName), eq(schema.queueJobs.status, status)),
      )
      .orderBy(sql`${schema.queueJobs.createdAt} DESC`)
      .offset(keepCount)

    if (jobsToDelete.length === 0) {
      return 0
    }

    const idsToDelete = jobsToDelete.map((job) => job.id)

    interface DeleteResult {
      rowCount: number
    }

    const result = (await this.db
      .delete(schema.queueJobs)
      .where(
        and(
          eq(schema.queueJobs.queueName, this.queueName),
          sql`${schema.queueJobs.id} = ANY(${idsToDelete})`,
        ),
      )) as DeleteResult

    return result.rowCount
  }

  async size(): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(schema.queueJobs)
      .where(
        and(eq(schema.queueJobs.queueName, this.queueName), eq(schema.queueJobs.status, "pending")),
      )

    return Number(result?.count ?? 0)
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.db.transaction(async () => fn())
  }

  protected async getDelayedJobReady(now: Date): Promise<BaseJob | null> {
    const [job] = await this.db
      .select()
      .from(schema.queueJobs)
      .where(
        and(
          eq(schema.queueJobs.queueName, this.queueName),
          eq(schema.queueJobs.status, "delayed"),
          lte(schema.queueJobs.processAt, now),
        ),
      )
      .orderBy(asc(schema.queueJobs.priority), asc(schema.queueJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true })

    return job ? this.transformJob(job) : null
  }

  protected async getPendingJobByPriority(): Promise<BaseJob | null> {
    const [job] = await this.db
      .select()
      .from(schema.queueJobs)
      .where(
        and(eq(schema.queueJobs.queueName, this.queueName), eq(schema.queueJobs.status, "pending")),
      )
      .orderBy(asc(schema.queueJobs.priority), asc(schema.queueJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true })

    return job ? this.transformJob(job) : null
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
