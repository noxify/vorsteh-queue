import type { PrismaClient } from "@prisma/client"

import type { BaseJob, JobStatus, QueueStats } from "@vorsteh-queue/core"
import { BaseQueueAdapter } from "@vorsteh-queue/core"

export class PrismaQueueAdapter extends BaseQueueAdapter {
  constructor(
    private readonly prisma: PrismaClient,
    queueName: string,
  ) {
    super(queueName)
  }

  async connect(): Promise<void> {
    await this.prisma.$connect()
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }

  async addJob<T>(job: Omit<BaseJob<T>, "id" | "createdAt">): Promise<BaseJob<T>> {
    const result = await this.prisma.queueJob.create({
      data: {
        queueName: this.queueName,
        name: job.name,
        payload: JSON.stringify(job.payload),
        status: job.status,
        priority: job.priority,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        processAt: job.processAt,
      },
    })

    return {
      id: result.id,
      name: result.name,
      payload: JSON.parse(result.payload) as T,
      status: result.status as JobStatus,
      priority: result.priority as BaseJob["priority"],
      attempts: result.attempts,
      maxAttempts: result.maxAttempts,
      createdAt: result.createdAt,
      processAt: result.processAt,
      processedAt: result.processedAt ?? undefined,
      completedAt: result.completedAt ?? undefined,
      failedAt: result.failedAt ?? undefined,
      error: result.error ?? undefined,
    }
  }

  async updateJobStatus(id: string, status: JobStatus, error?: string): Promise<void> {
    const now = new Date()

    await this.prisma.queueJob.update({
      where: { id },
      data: {
        status,
        error,
        processedAt: status === "processing" ? now : undefined,
        completedAt: status === "completed" ? now : undefined,
        failedAt: status === "failed" ? now : undefined,
      },
    })
  }

  async incrementJobAttempts(id: string): Promise<void> {
    await this.prisma.queueJob.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    })
  }

  async getQueueStats(): Promise<QueueStats> {
    const stats = await this.prisma.queueJob.groupBy({
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
      result[stat.status as JobStatus] = stat._count.status
    }

    return result
  }

  async clearJobs(status?: JobStatus): Promise<number> {
    const result = await this.prisma.queueJob.deleteMany({
      where: {
        queueName: this.queueName,
        ...(status && { status }),
      },
    })

    return result.count
  }

  async size(): Promise<number> {
    return this.prisma.queueJob.count({
      where: {
        queueName: this.queueName,
        status: "pending",
      },
    })
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async () => fn())
  }

  protected async getDelayedJobReady(now: Date): Promise<BaseJob | null> {
    const job = await this.prisma.queueJob.findFirst({
      where: {
        queueName: this.queueName,
        status: "delayed",
        processAt: { lte: now },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    })

    return job ? this.mapPrismaJobToBaseJob(job) : null
  }

  protected async getPendingJobByPriority(): Promise<BaseJob | null> {
    const job = await this.prisma.queueJob.findFirst({
      where: {
        queueName: this.queueName,
        status: "pending",
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    })

    return job ? this.mapPrismaJobToBaseJob(job) : null
  }

  private mapPrismaJobToBaseJob(job: any): BaseJob {
    return {
      id: job.id,
      name: job.name,
      payload: JSON.parse(job.payload),
      status: job.status as JobStatus,
      priority: job.priority as BaseJob["priority"],
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      processAt: job.processAt,
      processedAt: job.processedAt ?? undefined,
      completedAt: job.completedAt ?? undefined,
      failedAt: job.failedAt ?? undefined,
      error: job.error ?? undefined,
    }
  }
}
