import type { BaseJob, JobStatus, QueueStats, SerializedError } from "@vorsteh-queue/core"
import { BaseQueueAdapter, serializeError } from "@vorsteh-queue/core"

import type { PrismaClient, PrismaClientInternal } from "../types"
import type { QueueJobModel as QueueJob } from "./generated/prisma/models"

/**
 * MySQL/MariaDB adapter for the queue system using Prisma ORM.
 * Uses raw SQL with SKIP LOCKED for critical job selection methods to prevent race conditions.
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client'
 * import { MySQLPrismaQueueAdapter } from '@vorsteh-queue/adapter-prisma'
 *
 * const prisma = new PrismaClient()
 * const queue = new Queue(new MySQLPrismaQueueAdapter(prisma), { name: "my-queue" })
 * ```
 */
export class MySQLPrismaQueueAdapter extends BaseQueueAdapter {
  private readonly db: PrismaClientInternal
  private readonly modelName: string

  /**
   * Create a new MySQL/MariaDB Prisma queue adapter.
   *
   * @param prisma - Any PrismaClient instance
   * @param config - Optional configuration
   */
  constructor(prisma: PrismaClient) {
    super()
    this.db = prisma as PrismaClientInternal
    this.modelName = "queueJob"
  }

  async connect(): Promise<void> {
    await this.db.$connect()
  }

  async disconnect(): Promise<void> {
    await this.db.$disconnect()
  }

  async addJob<TJobPayload>(
    job: Omit<BaseJob<TJobPayload>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload>> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = (await this.db[this.modelName]!.create({
      data: {
        queueName: this.queueName,
        name: job.name,
        payload: job.payload,
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        processAt: job.processAt,
        progress: job.progress ?? 0,
        cron: job.cron ?? null,
        repeatEvery: job.repeatEvery ?? null,
        repeatLimit: job.repeatLimit ?? null,
        repeatCount: job.repeatCount ?? 0,
      },
    })) as QueueJob

    return this.transformJob(result) as BaseJob<TJobPayload>
  }

  async updateJobStatus(id: string, status: JobStatus, error?: unknown): Promise<void> {
    const now = new Date()
    const updates: Record<string, unknown> = { status }

    if (error) updates.error = serializeError(error)
    if (status === "processing") updates.processedAt = now
    if (status === "completed") updates.completedAt = now
    if (status === "failed") updates.failedAt = now

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: updates,
    })
  }

  async incrementJobAttempts(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  }

  async updateJobProgress(id: string, progress: number): Promise<void> {
    const normalizedProgress = Math.max(0, Math.min(100, progress))

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await this.db[this.modelName]!.update({
      where: { id },
      data: { progress: normalizedProgress },
    })
  }

  async getQueueStats(): Promise<QueueStats> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion
    const stats = await this.db[this.modelName]!.groupBy({
      by: ["status"],
      where: { queueName: this.queueName },
      _count: { status: true },
    })

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    }
    for (const stat of stats) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      result[stat.status as JobStatus] = Number(stat._count.status)
    }

    return result
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const where: Record<string, unknown> = { queueName: this.queueName }
    if (status) where.status = status

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = await this.db[this.modelName]!.deleteMany({ where })
    return result.count
  }

  async cleanupJobs(status: JobStatus, keepCount: number): Promise<number> {
    // Get jobs to delete (all except the most recent N)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jobsToDelete = (await this.db[this.modelName]!.findMany({
      where: {
        queueName: this.queueName,
        status: status,
      },
      orderBy: { createdAt: "desc" },
      skip: keepCount,
      select: { id: true },
    })) as QueueJob[]

    if (jobsToDelete.length === 0) {
      return 0
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = (await this.db[this.modelName]!.deleteMany({
      where: {
        id: { in: jobsToDelete.map((job) => job.id) },
      },
    })) as { count: number }

    return result.count
  }

  async size(): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.db[this.modelName]!.count({
      where: {
        queueName: this.queueName,
        status: "pending",
      },
    })
  }

  async transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult> {
    return this.db.$transaction(async () => fn())
  }

  protected async getDelayedJobReady(now: Date): Promise<BaseJob | null> {
    // Use raw SQL with SKIP LOCKED for race condition prevention
    const result = await this.db.$queryRaw<QueueJob[]>`
      SELECT * FROM queue_jobs
      WHERE queue_name = ${this.queueName}
        AND status = 'delayed'
        AND process_at <= ${now}
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return result.length > 0 ? this.transformJob(result[0]!) : null
  }

  protected async getPendingJobByPriority(): Promise<BaseJob | null> {
    // Use raw SQL with SKIP LOCKED for race condition prevention
    const result = await this.db.$queryRaw<QueueJob[]>`
      SELECT * FROM queue_jobs
      WHERE queue_name = ${this.queueName}
        AND status = 'pending'
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return result.length > 0 ? this.transformJob(result[0]!) : null
  }

  private transformJob(job: QueueJob): BaseJob {
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
      error: job.error as unknown as SerializedError | undefined,
      progress: job.progress ?? 0,
      cron: job.cron ?? undefined,
      repeatEvery: job.repeatEvery ?? undefined,
      repeatLimit: job.repeatLimit ?? undefined,
      repeatCount: job.repeatCount ?? 0,
    }
  }
}
