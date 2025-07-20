import type { MySql2Database } from "drizzle-orm/mysql2"
import type { Connection, Pool } from "mysql2/promise"
import { and, asc, count, eq, lte, sql } from "drizzle-orm"

import type { BaseJob, JobStatus, QueueStats, SerializedError } from "@vorsteh-queue/core"
import { BaseQueueAdapter, serializeError } from "@vorsteh-queue/core"

import * as schema from "./mariadb-schema"

type MariaDBDatabase =
  | MySql2Database<typeof schema>
  | (MySql2Database<typeof schema> & { $client: Connection | Pool })

/**
 * MariaDB adapter for the queue system using Drizzle ORM.
 * Supports MariaDB 10.6+ with SKIP LOCKED functionality.
 *
 * @example
 * ```typescript
 * import { drizzle } from "drizzle-orm/mysql2"
 * import mysql from "mysql2/promise"
 *
 * const connection = await mysql.createConnection({
 *   host: "localhost",
 *   user: "root",
 *   password: "password",
 *   database: "queue_db"
 * })
 * const db = drizzle(connection)
 * const adapter = new MariaDBQueueAdapter(db)
 * ```
 */
export class MariaDBQueueAdapter extends BaseQueueAdapter {
  /**
   * Create a new MariaDB queue adapter.
   *
   * @param db - Drizzle MariaDB database instance
   */
  constructor(private readonly db: MariaDBDatabase) {
    super()
  }

  async connect(): Promise<void> {
    // Drizzle doesn't require explicit connection
  }

  async disconnect(): Promise<void> {
    // Drizzle doesn't require explicit disconnection
  }

  async addJob<TJobPayload>(
    job: Omit<BaseJob<TJobPayload>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload>> {
    await this.db.insert(schema.queueJobs).values({
      queueName: this.queueName,
      name: job.name,
      payload: job.payload,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      processAt: sql`${job.processAt.toISOString()}`,
      cron: job.cron,
      repeatEvery: job.repeatEvery,
      repeatLimit: job.repeatLimit,
      repeatCount: job.repeatCount,
    })

    // Get the most recently inserted job for this queue
    const [insertedJob] = await this.db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.queueName, this.queueName))
      .orderBy(sql`created_at DESC`)
      .limit(1)

    if (!insertedJob) {
      throw new Error("Failed to create job")
    }

    return this.transformJob(insertedJob) as BaseJob<TJobPayload>
  }

  async updateJobStatus(id: string, status: JobStatus, error?: unknown): Promise<void> {
    const now = new Date()
    const updates: Record<string, unknown> = { status }

    if (error) updates.error = serializeError(error)
    if (status === "processing") updates.processedAt = sql`${now.toISOString()}`
    if (status === "completed") updates.completedAt = sql`${now.toISOString()}`
    if (status === "failed") updates.failedAt = sql`${now.toISOString()}`

    await this.db.update(schema.queueJobs).set(updates).where(eq(schema.queueJobs.id, id))
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.db
      .update(schema.queueJobs)
      .set({ attempts: sql`${schema.queueJobs.attempts} + 1` })
      .where(eq(schema.queueJobs.id, id))
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
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

    const result = await this.db.delete(schema.queueJobs).where(and(...conditions))

    return (result as unknown as { affectedRows: number }).affectedRows
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

    const result = await this.db
      .delete(schema.queueJobs)
      .where(
        and(
          eq(schema.queueJobs.queueName, this.queueName),
          sql`${schema.queueJobs.id} IN (${idsToDelete.join(",")})`,
        ),
      )

    return (result as unknown as { affectedRows: number }).affectedRows
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
      .for("update", { skipLocked: true }) // MariaDB 10.6+ supports SKIP LOCKED

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
      .for("update", { skipLocked: true }) // MariaDB 10.6+ supports SKIP LOCKED

    return job ? this.transformJob(job) : null
  }

  private transformJob(job: schema.QueueJob): BaseJob {
    return {
      id: job.id,
      name: job.name,
      payload: typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload,
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
      progress: job.progress ?? 0,
      cron: job.cron ?? undefined,
      repeatEvery: job.repeatEvery ?? undefined,
      repeatLimit: job.repeatLimit ?? undefined,
      repeatCount: job.repeatCount ?? 0,
    }
  }
}
