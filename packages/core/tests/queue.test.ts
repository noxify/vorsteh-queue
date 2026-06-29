import { beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import { DuplicateJobError } from "../src/errors"
import { Queue } from "../src/queue"

describe("Queue (Producer)", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "test-queue" })
    await queue.connect()
  })

  describe("add", () => {
    it("should add a job and return it", async () => {
      /* eslint-disable vitest/max-expects */
      const job = await queue.add("send-email", { to: "user@test.com" })

      expect(job.id).toBeDefined()
      expect(job.name).toBe("send-email")
      expect(job.payload).toStrictEqual({ to: "user@test.com" })
      expect(job.status).toBe("pending")
      expect(job.priority).toBe(2)
      expect(job.attempts).toBe(0)
      expect(job.maxAttempts).toBe(3)
      /* eslint-enable vitest/max-expects */
    })

    it("should apply custom priority", async () => {
      const job = await queue.add("urgent", {}, { priority: 1 })
      expect(job.priority).toBe(1)
    })

    it("should create delayed job with delay option", async () => {
      const job = await queue.add("delayed", {}, { delay: 5000 })
      expect(job.status).toBe("delayed")
      expect(job.processAt.getTime()).toBeGreaterThan(Date.now())
    })

    it("should create delayed job with cron option", async () => {
      const job = await queue.add("cron", {}, { cron: "0 9 * * *" })
      expect(job.status).toBe("delayed")
      expect(job.cron).toBe("0 9 * * *")
    })

    it("should emit job:added event", async () => {
      const listener = vi.fn<() => void>()
      queue.on("job:added", listener)

      await queue.add("test", { data: 1 })

      expect(listener).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ name: "test" })
      )
    })

    it("should set unique key", async () => {
      const job = await queue.add(
        "sync",
        {},
        {
          unique: { key: "sync:123", action: "reject" },
        }
      )
      expect(job.uniqueKey).toBe("sync:123")
    })

    it("should reject duplicate unique jobs", async () => {
      await queue.add("sync", {}, { unique: { key: "dup", action: "reject" } })

      await expect(
        queue.add("sync", {}, { unique: { key: "dup", action: "reject" } })
      ).rejects.toThrow(DuplicateJobError)
    })

    it("should replace duplicate unique jobs", async () => {
      const first = await queue.add(
        "sync",
        { v: 1 },
        {
          unique: { key: "replace-me", action: "replace" },
        }
      )

      const second = await queue.add(
        "sync",
        { v: 2 },
        {
          unique: { key: "replace-me", action: "replace" },
        }
      )

      expect(second.id).not.toBe(first.id)
      const oldJob = await queue.getJob(first.id)
      expect(oldJob?.status).toBe("cancelled")
    })

    it("should set group key", async () => {
      const job = await queue.add("grouped", {}, { group: "tenant-1" })
      expect(job.groupKey).toBe("tenant-1")
    })
  })

  describe("addJobs", () => {
    it("should add multiple jobs", async () => {
      const jobs = await queue.addJobs("batch", [{ n: 1 }, { n: 2 }, { n: 3 }])

      expect(jobs).toHaveLength(3)
      expect(jobs[0]?.name).toBe("batch")
      expect(jobs[2]?.payload).toStrictEqual({ n: 3 })
    })

    it("should emit job:added for each job", async () => {
      const listener = vi.fn<() => void>()
      queue.on("job:added", listener)

      await queue.addJobs("multi", [{ a: 1 }, { a: 2 }])
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })

  describe("cancel / cancelAll", () => {
    it("should cancel a job by ID", async () => {
      const job = await queue.add("cancellable", {})
      await queue.cancel(job.id, "no longer needed")

      const updated = await queue.getJob(job.id)
      expect(updated?.status).toBe("cancelled")
    })

    it("should emit job:cancelled event", async () => {
      const listener = vi.fn<() => void>()
      queue.on("job:cancelled", listener)

      const job = await queue.add("cancellable", {})
      await queue.cancel(job.id, "reason")

      expect(listener).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ cancellationReason: "reason" })
      )
    })

    it("should cancel multiple jobs with filter", async () => {
      await queue.add("email", {})
      await queue.add("email", {})
      await queue.add("sms", {})

      const count = await queue.cancelAll({ name: "email" })
      expect(count).toBe(2)
    })
  })

  describe("getJob / getStats / clear", () => {
    it("should get a job by ID", async () => {
      const job = await queue.add("lookup", { key: "value" })
      const retrieved = await queue.getJob(job.id)

      expect(retrieved?.id).toBe(job.id)
      expect(retrieved?.payload).toStrictEqual({ key: "value" })
    })

    it("should return null for unknown job", async () => {
      const result = await queue.getJob("unknown-id")
      expect(result).toBeNull()
    })

    it("should return queue stats", async () => {
      await queue.add("a", {})
      await queue.add("b", {})

      const stats = await queue.getStats()
      expect(stats.pending).toBe(2)
    })

    it("should clear all jobs", async () => {
      await queue.add("a", {})
      await queue.add("b", {})

      const count = await queue.clear()
      expect(count).toBe(2)
      const statsAfterClear = await queue.getStats()
      expect(statsAfterClear.pending).toBe(0)
    })
  })

  describe("DLQ: getDeadJobs / redrive / redriveAll", () => {
    it("should get dead jobs", async () => {
      const job = await queue.add("failing", {})
      await adapter.updateJobStatus(job.id, { status: "dead" })

      const dead = await queue.getDeadJobs()
      expect(dead).toHaveLength(1)
    })

    it("should redrive a dead job", async () => {
      const job = await queue.add("failing", {})
      await adapter.updateJobStatus(job.id, { status: "dead" })
      await queue.redrive(job.id)

      const updated = await queue.getJob(job.id)
      expect(updated?.status).toBe("pending")
    })

    it("should redrive all dead jobs", async () => {
      const j1 = await queue.add("a", {})
      const j2 = await queue.add("b", {})
      await adapter.updateJobStatus(j1.id, { status: "dead" })
      await adapter.updateJobStatus(j2.id, { status: "dead" })

      const count = await queue.redriveAll()
      expect(count).toBe(2)
    })
  })

  describe("defaultJobOptions", () => {
    it("should apply default options from config", async () => {
      const customQueue = new Queue(adapter, {
        name: "test-queue",
        defaultJobOptions: { priority: 1, maxAttempts: 5 },
      })
      await customQueue.connect()

      const job = await customQueue.add("default-test", {})
      expect(job.priority).toBe(1)
      expect(job.maxAttempts).toBe(5)
    })

    it("should allow per-job override of defaults", async () => {
      const customQueue = new Queue(adapter, {
        name: "test-queue",
        defaultJobOptions: { priority: 1 },
      })
      await customQueue.connect()

      const job = await customQueue.add("override", {}, { priority: 5 })
      expect(job.priority).toBe(5)
    })
  })

  describe("retry / runNow / deleteJob", () => {
    it("should retry a failed job", async () => {
      const job = await queue.add("failing", {})
      await adapter.updateJobStatus(job.id, {
        status: "failed",
        error: { name: "Error", message: "fail" },
      })

      const success = await queue.retry(job.id)
      expect(success).toBeTruthy()

      const updated = await queue.getJob(job.id)
      expect(updated?.status).toBe("pending")
      expect(updated?.attempts).toBe(0)
      expect(updated?.error).toBeUndefined()
    })

    it("should not retry a non-failed job", async () => {
      const job = await queue.add("pending-job", {})
      const success = await queue.retry(job.id)
      expect(success).toBeFalsy()
    })

    it("should promote a delayed job to run now", async () => {
      const job = await queue.add("delayed", {}, { delay: 60_000 })
      expect(job.status).toBe("delayed")

      const success = await queue.runNow(job.id)
      expect(success).toBeTruthy()

      const updated = await queue.getJob(job.id)
      expect(updated?.status).toBe("pending")
      expect(updated?.processAt.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it("should not run-now a non-delayed job", async () => {
      const job = await queue.add("pending-job", {})
      const success = await queue.runNow(job.id)
      expect(success).toBeFalsy()
    })

    it("should delete a job", async () => {
      const job = await queue.add("deletable", {})
      const success = await queue.deleteJob(job.id)
      expect(success).toBeTruthy()

      const found = await queue.getJob(job.id)
      expect(found).toBeNull()
    })

    it("should return false when deleting non-existent job", async () => {
      const success = await queue.deleteJob("nonexistent-id")
      expect(success).toBeFalsy()
    })
  })
})
