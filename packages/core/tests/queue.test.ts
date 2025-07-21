import { beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter, Queue } from "../src"
import { waitFor } from "../src/utils/helpers"

describe("Queue", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(() => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "test-queue", processingInterval: 10, jobInterval: 1 })
  })

  describe("basic operations", () => {
    it("should connect and disconnect", async () => {
      await queue.connect()
      await queue.disconnect()
    })

    it("should register job handlers", () => {
      const handler = vi.fn()
      queue.register("test-job", handler)
      void queue.enqueue("test-job-2", handler)
    })

    it("should add jobs to queue", async () => {
      await queue.connect()

      const job = await queue.add("test-job", { data: "test" })

      expect(job.name).toBe("test-job")
      expect(job.payload).toEqual({ data: "test" })
      expect(job.status).toBe("pending")
      expect(job.priority).toBe(2)
    })

    it("should add jobs with enqueue alias", async () => {
      await queue.connect()

      const job = await queue.enqueue("test-job", { data: "test" })

      expect(job.name).toBe("test-job")
      expect(job.payload).toEqual({ data: "test" })
    })

    it("should add delayed jobs", async () => {
      await queue.connect()

      const job = await queue.add("test-job", { data: "test" }, { delay: 1000 })

      expect(job.status).toBe("delayed")
      expect(job.processAt.getTime()).toBeGreaterThan(Date.now())
    })

    it("should add jobs with priority", async () => {
      await queue.connect()

      const job = await queue.add("test-job", { data: "test" }, { priority: 1 })

      expect(job.priority).toBe(1)
    })
  })

  describe("job processing", () => {
    it("should process jobs", async () => {
      const handler = vi.fn().mockResolvedValue({ result: "success" })
      queue.register("test-job", handler)

      await queue.connect()
      await queue.add("test-job", { data: "test" })
      queue.start()

      await waitFor(100)

      expect(handler).toHaveBeenCalled()

      await queue.stop()
    })

    it("should emit job events", async () => {
      const addedSpy = vi.fn()
      const processingSpy = vi.fn()
      const completedSpy = vi.fn()

      queue.on("job:added", addedSpy)
      queue.on("job:processing", processingSpy)
      queue.on("job:completed", completedSpy)

      queue.register("test-job", vi.fn().mockResolvedValue({}))

      await queue.connect()
      await queue.add("test-job", { data: "test" })
      queue.start()

      await waitFor(100)

      expect(addedSpy).toHaveBeenCalled()
      expect(processingSpy).toHaveBeenCalled()
      expect(completedSpy).toHaveBeenCalled()

      await queue.stop()
    })

    it("should handle job failures and retries", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Test error"))
      const failedSpy = vi.fn()
      const retriedSpy = vi.fn()

      queue.on("job:failed", failedSpy)
      queue.on("job:retried", retriedSpy)
      queue.register("test-job", handler)

      await queue.connect()
      await queue.add("test-job", { data: "test" }, { maxAttempts: 2 })
      queue.start()

      await waitFor(200)

      expect(handler).toHaveBeenCalledTimes(2)
      expect(retriedSpy).toHaveBeenCalled()
      expect(failedSpy).toHaveBeenCalled()

      await queue.stop()
    })
  })

  describe("cleanup configuration", () => {
    it("should accept boolean values for cleanup options", () => {
      const queue1 = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: true,
        removeOnFail: false,
      })

      const queue2 = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: false,
        removeOnFail: true,
      })

      expect(queue1).toBeDefined()
      expect(queue2).toBeDefined()
    })

    it("should accept number values for cleanup options", () => {
      const queue = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: 100,
        removeOnFail: 50,
      })

      expect(queue).toBeDefined()
    })

    it("should accept mixed boolean and number values", () => {
      const queue = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: true,
        removeOnFail: 25,
      })

      expect(queue).toBeDefined()
    })
  })

  describe("queue control", () => {
    it("should pause and resume queue", () => {
      const pausedSpy = vi.fn()
      const resumedSpy = vi.fn()

      queue.on("queue:paused", pausedSpy)
      queue.on("queue:resumed", resumedSpy)

      queue.pause()
      expect(pausedSpy).toHaveBeenCalled()

      queue.resume()
      expect(resumedSpy).toHaveBeenCalled()
    })

    it("should get queue stats", async () => {
      await queue.connect()
      await queue.add("test-job", { data: "test" })

      const stats = await queue.getStats()

      expect(stats.pending).toBe(1)
      expect(stats.processing).toBe(0)
      expect(stats.completed).toBe(0)
      expect(stats.failed).toBe(0)
    })

    it("should clear jobs", async () => {
      await queue.connect()
      await queue.add("test-job", { data: "test" })

      const cleared = await queue.clear("pending")

      expect(cleared).toBe(1)

      const stats = await queue.getStats()
      expect(stats.pending).toBe(0)
    })

    it("should dequeue jobs", async () => {
      await queue.connect()
      await queue.add("test-job", { data: "test" })

      const job = await queue.dequeue()

      expect(job?.name).toBe("test-job")
      expect(job?.payload).toEqual({ data: "test" })

      const stats = await queue.getStats()
      expect(stats.completed).toBe(1)
    })
  })

  describe("result handling", () => {
    it("should store job result when job completes successfully", async () => {
      const result = { success: true, data: "processed" }
      const handler = vi.fn().mockResolvedValue(result)
      const completedSpy = vi.fn()

      queue.register("test-job", handler)
      queue.on("job:completed", completedSpy)

      await queue.connect()
      await queue.add("test-job", { input: "test" })
      queue.start()

      await waitFor(100)

      expect(handler).toHaveBeenCalled()
      expect(completedSpy).toHaveBeenCalled()

      const completedJob = completedSpy.mock.calls[0]?.[0] as { result: unknown }
      expect(completedJob.result).toEqual(result)

      await queue.stop()
    })

    it("should handle null/undefined results", async () => {
      const handler = vi.fn().mockResolvedValue(null)
      const completedSpy = vi.fn()

      queue.register("test-job", handler)
      queue.on("job:completed", completedSpy)

      await queue.connect()
      await queue.add("test-job", { input: "test" })
      queue.start()

      await waitFor(100)

      const completedJob = completedSpy.mock.calls[0]?.[0] as { result: unknown }
      expect(completedJob.result).toBeNull()

      await queue.stop()
    })

    it("should handle complex result objects", async () => {
      const result = {
        processed: 100,
        errors: [],
        metadata: { timestamp: new Date().toISOString() },
        nested: { deep: { value: "test" } },
      }
      const handler = vi.fn().mockResolvedValue(result)
      const completedSpy = vi.fn()

      queue.register("test-job", handler)
      queue.on("job:completed", completedSpy)

      await queue.connect()
      await queue.add("test-job", { input: "test" })
      queue.start()

      await waitFor(100)

      const completedJob = completedSpy.mock.calls[0]?.[0] as { result: unknown }
      expect(completedJob.result).toEqual(result)

      await queue.stop()
    })

    it("should not store result when job fails", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Test error"))
      const failedSpy = vi.fn()

      queue.register("test-job", handler)
      queue.on("job:failed", failedSpy)

      await queue.connect()
      await queue.add("test-job", { input: "test" }, { maxAttempts: 1 })
      queue.start()

      await waitFor(100)

      const failedJob = failedSpy.mock.calls[0]?.[0] as { result?: unknown; error: unknown }
      expect(failedJob.result).toBeUndefined()
      expect(failedJob.error).toBeDefined()

      await queue.stop()
    })
  })
})
