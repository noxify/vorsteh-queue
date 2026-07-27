import { beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import type { NewJob } from "../src/types"

function makeJob(overrides: Partial<NewJob> = {}): NewJob {
  return {
    attempts: 0,
    maxAttempts: 3,
    name: "test-job",
    payload: { data: "test" },
    priority: 2,
    processAt: new Date(),
    progress: 0,
    repeatCount: 0,
    status: "pending",
    ...overrides,
  }
}

describe(MemoryQueueAdapter, () => {
  let adapter: MemoryQueueAdapter

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    await adapter.connect()
    adapter.setQueueName("test-queue")
  })

  describe("addJob / getJobById", () => {
    it("should add a job and retrieve it by ID", async () => {
      const job = await adapter.addJob(makeJob())

      expect(job.id).toBeDefined()
      expect(job.name).toBe("test-job")
      expect(job.status).toBe("pending")
      expect(job.createdAt).toBeInstanceOf(Date)

      const retrieved = await adapter.getJobById(job.id)
      expect(retrieved).toStrictEqual(job)
    })

    it("should return null for unknown ID", async () => {
      const result = await adapter.getJobById("nonexistent")
      expect(result).toBeNull()
    })
  })

  describe("addJobs", () => {
    it("should add multiple jobs", async () => {
      const jobs = await adapter.addJobs([
        makeJob({ name: "a" }),
        makeJob({ name: "b" }),
      ])

      expect(jobs).toHaveLength(2)
      expect(jobs[0]?.name).toBe("a")
      expect(jobs[1]?.name).toBe("b")
    })
  })

  describe("getNextJob", () => {
    it("should return the highest priority job", async () => {
      await adapter.addJob(makeJob({ name: "low", priority: 5 }))
      await adapter.addJob(makeJob({ name: "high", priority: 1 }))

      const job = await adapter.getNextJob({
        activeGroups: [],
        handlerNames: ["low", "high"],
      })
      expect(job?.name).toBe("high")
    })

    it("should return null when no jobs available", async () => {
      const job = await adapter.getNextJob({
        activeGroups: [],
        handlerNames: ["test-job"],
      })
      expect(job).toBeNull()
    })

    it("should only return jobs for registered handlers", async () => {
      await adapter.addJob(makeJob({ name: "unregistered" }))

      const job = await adapter.getNextJob({
        activeGroups: [],
        handlerNames: ["registered"],
      })
      expect(job).toBeNull()
    })

    it("should skip groups that are active", async () => {
      await adapter.addJob(makeJob({ groupKey: "g1", name: "grouped" }))
      await adapter.addJob(makeJob({ groupKey: "g2", name: "grouped" }))

      const job = await adapter.getNextJob({
        activeGroups: ["g1"],
        handlerNames: ["grouped"],
      })
      expect(job?.groupKey).toBe("g2")
    })

    it("should promote delayed jobs that are ready", async () => {
      await adapter.addJob(
        makeJob({ processAt: new Date(Date.now() - 1000), status: "delayed" })
      )

      const job = await adapter.getNextJob({
        activeGroups: [],
        handlerNames: ["test-job"],
      })
      expect(job).not.toBeNull()
      expect(job?.status).toBe("pending")
    })

    it("should not promote delayed jobs that are not ready", async () => {
      await adapter.addJob(
        makeJob({ processAt: new Date(Date.now() + 60_000), status: "delayed" })
      )

      const job = await adapter.getNextJob({
        activeGroups: [],
        handlerNames: ["test-job"],
      })
      expect(job).toBeNull()
    })
  })

  describe("getNextJobsForHandler", () => {
    it("should return jobs for a specific handler", async () => {
      await adapter.addJob(makeJob({ name: "target" }))
      await adapter.addJob(makeJob({ name: "target" }))
      await adapter.addJob(makeJob({ name: "other" }))

      const jobs = await adapter.getNextJobsForHandler("target", 10, [])
      expect(jobs).toHaveLength(2)
    })

    it("should respect count limit", async () => {
      await adapter.addJob(makeJob({ name: "x" }))
      await adapter.addJob(makeJob({ name: "x" }))
      await adapter.addJob(makeJob({ name: "x" }))

      const jobs = await adapter.getNextJobsForHandler("x", 2, [])
      expect(jobs).toHaveLength(2)
    })

    it("should respect group constraints", async () => {
      await adapter.addJob(makeJob({ groupKey: "active-group", name: "x" }))
      await adapter.addJob(makeJob({ groupKey: "free-group", name: "x" }))

      const jobs = await adapter.getNextJobsForHandler("x", 10, [
        "active-group",
      ])
      expect(jobs).toHaveLength(1)
      expect(jobs[0]?.groupKey).toBe("free-group")
    })
  })

  describe("updateJobStatus", () => {
    it("should update job status", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job.id, { status: "processing" })

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("processing")
      expect(updated?.processedAt).toBeInstanceOf(Date)
    })

    it("should set completedAt on completed", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job.id, {
        result: { ok: true },
        status: "completed",
      })

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("completed")
      expect(updated?.completedAt).toBeInstanceOf(Date)
      expect(updated?.result).toStrictEqual({ ok: true })
    })

    it("should set cancelledAt on cancelled", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job.id, {
        cancellationReason: "test",
        status: "cancelled",
      })

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("cancelled")
      expect(updated?.cancelledAt).toBeInstanceOf(Date)
      expect(updated?.cancellationReason).toBe("test")
    })
  })

  describe("incrementJobAttempts", () => {
    it("should increment attempts by 1", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.incrementJobAttempts(job.id)

      const updated = await adapter.getJobById(job.id)
      expect(updated?.attempts).toBe(1)
    })
  })

  describe("updateJobProgress", () => {
    it("should update progress", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.updateJobProgress(job.id, 50)

      const updated = await adapter.getJobById(job.id)
      expect(updated?.progress).toBe(50)
    })

    it("should clamp progress to 0-100", async () => {
      const job = await adapter.addJob(makeJob())

      await adapter.updateJobProgress(job.id, -10)
      let updated = await adapter.getJobById(job.id)
      expect(updated?.progress).toBe(0)

      await adapter.updateJobProgress(job.id, 200)
      updated = await adapter.getJobById(job.id)
      expect(updated?.progress).toBe(100)
    })
  })

  describe("cancelJob / cancelJobs", () => {
    it("should cancel a pending job", async () => {
      const job = await adapter.addJob(makeJob())
      const result = await adapter.cancelJob(job.id, "no longer needed")

      expect(result).toBeTruthy()
      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("cancelled")
      expect(updated?.cancellationReason).toBe("no longer needed")
    })

    it("should not cancel a completed job", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job.id, { status: "completed" })

      const result = await adapter.cancelJob(job.id)
      expect(result).toBeFalsy()
    })

    it("should cancel multiple jobs matching filter", async () => {
      await adapter.addJob(makeJob({ name: "email" }))
      await adapter.addJob(makeJob({ name: "email" }))
      await adapter.addJob(makeJob({ name: "sms" }))

      const count = await adapter.cancelJobs({ name: "email" })
      expect(count).toBe(2)
    })
  })

  describe("DLQ: getDeadJobs / redriveJob / redriveJobs", () => {
    it("should return dead jobs", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job.id, { status: "dead" })

      const dead = await adapter.getDeadJobs()
      expect(dead).toHaveLength(1)
      expect(dead[0]?.id).toBe(job.id)
    })

    it("should redrive a dead job to pending", async () => {
      const job = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job.id, { status: "dead" })
      await adapter.redriveJob(job.id)

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
      expect(updated?.attempts).toBe(0)
    })

    it("should redrive all dead jobs", async () => {
      const job1 = await adapter.addJob(makeJob({ name: "a" }))
      const job2 = await adapter.addJob(makeJob({ name: "b" }))
      await adapter.updateJobStatus(job1.id, { status: "dead" })
      await adapter.updateJobStatus(job2.id, { status: "dead" })

      const count = await adapter.redriveJobs()
      expect(count).toBe(2)
    })

    it("should filter redrive by name", async () => {
      const job1 = await adapter.addJob(makeJob({ name: "email" }))
      const job2 = await adapter.addJob(makeJob({ name: "sms" }))
      await adapter.updateJobStatus(job1.id, { status: "dead" })
      await adapter.updateJobStatus(job2.id, { status: "dead" })

      const count = await adapter.redriveJobs({ name: "email" })
      expect(count).toBe(1)
    })
  })

  describe("getQueueStats", () => {
    it("should return counts by status", async () => {
      await adapter.addJob(makeJob({ status: "pending" }))
      await adapter.addJob(makeJob({ status: "pending" }))
      const completedJob = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(completedJob.id, { status: "completed" })

      const stats = await adapter.getQueueStats()
      expect(stats.pending).toBe(2)
      expect(stats.completed).toBe(1)
      expect(stats.failed).toBe(0)
    })
  })

  describe("size", () => {
    it("should count pending + delayed jobs", async () => {
      await adapter.addJob(makeJob({ status: "pending" }))
      await adapter.addJob(
        makeJob({ processAt: new Date(Date.now() + 60_000), status: "delayed" })
      )
      const completedJob = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(completedJob.id, { status: "completed" })

      const size = await adapter.size()
      expect(size).toBe(2)
    })
  })

  describe("clearJobs / cleanupJobs", () => {
    it("should clear all jobs", async () => {
      await adapter.addJob(makeJob())
      await adapter.addJob(makeJob())

      const count = await adapter.clearJobs()
      expect(count).toBe(2)
      await expect(adapter.size()).resolves.toBe(0)
    })

    it("should clear jobs by status", async () => {
      await adapter.addJob(makeJob({ status: "pending" }))
      const completed = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(completed.id, { status: "completed" })

      const count = await adapter.clearJobs("completed")
      expect(count).toBe(1)
      await expect(adapter.size()).resolves.toBe(1)
    })

    it("should cleanup keeping only N newest", async () => {
      const job1 = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job1.id, { status: "completed" })
      const job2 = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job2.id, { status: "completed" })
      const job3 = await adapter.addJob(makeJob())
      await adapter.updateJobStatus(job3.id, { status: "completed" })

      const deleted = await adapter.cleanupJobs("completed", 1)
      expect(deleted).toBe(2)
    })
  })

  describe("findJobByUniqueKey", () => {
    it("should find active job by unique key", async () => {
      await adapter.addJob(makeJob({ uniqueKey: "unique-1" }))

      const found = await adapter.findJobByUniqueKey("unique-1")
      expect(found).not.toBeNull()
      expect(found?.uniqueKey).toBe("unique-1")
    })

    it("should not find completed job by unique key", async () => {
      const job = await adapter.addJob(makeJob({ uniqueKey: "unique-2" }))
      await adapter.updateJobStatus(job.id, { status: "completed" })

      const found = await adapter.findJobByUniqueKey("unique-2")
      expect(found).toBeNull()
    })

    it("should return null for unknown key", async () => {
      const found = await adapter.findJobByUniqueKey("nonexistent")
      expect(found).toBeNull()
    })
  })
})
