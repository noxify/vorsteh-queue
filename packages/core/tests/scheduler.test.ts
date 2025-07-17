import { beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter, Queue } from "../src"
import { waitFor } from "../src/utils/helpers"

describe("Scheduler", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(() => {
    adapter = new MemoryQueueAdapter("test-queue")
    queue = new Queue(adapter, { name: "test-queue", processingInterval: 10, jobInterval: 1 })
  })

  describe("absolute scheduling", () => {
    it("should schedule job to run at specific time", async () => {
      const runAt = new Date(Date.now() + 100)

      await queue.connect()
      const job = await queue.add("test-job", { data: "test" }, { runAt })

      expect(job.status).toBe("delayed")
      expect(job.processAt).toEqual(runAt)
    })

    it("should run job immediately if runAt is in the past", async () => {
      const runAt = new Date(Date.now() - 100)

      await queue.connect()
      const job = await queue.add("test-job", { data: "test" }, { runAt })

      expect(job.status).toBe("pending")
    })
  })

  describe("recurring jobs", () => {
    it("should create recurring job with repeat interval", async () => {
      const handler = vi.fn().mockResolvedValue({})
      queue.register("recurring-job", handler)

      await queue.connect()
      await queue.add(
        "recurring-job",
        { data: "test" },
        {
          repeat: { every: 50, limit: 2 },
        },
      )
      queue.start()

      await waitFor(200)

      expect(handler).toHaveBeenCalledTimes(2)

      await queue.stop()
    })

    it("should respect repeat limit", async () => {
      const handler = vi.fn().mockResolvedValue({})
      queue.register("limited-job", handler)

      await queue.connect()
      await queue.add(
        "limited-job",
        { data: "test" },
        {
          repeat: { every: 20, limit: 1 },
        },
      )
      queue.start()

      await waitFor(100)

      expect(handler).toHaveBeenCalledTimes(1)

      await queue.stop()
    })
  })

  describe("cron scheduling", () => {
    it("should create job with cron expression", async () => {
      await queue.connect()
      const job = await queue.add(
        "cron-job",
        { data: "test" },
        {
          cron: "0 9 * * *", // Every day at 9 AM
        },
      )

      expect(job.cron).toBe("0 9 * * *")
    })
  })
})
