import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter, Queue } from "../src"

describe("Job Cleanup", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(() => {
    adapter = new MemoryQueueAdapter("test-queue")
    vi.spyOn(adapter, "clearJobs").mockResolvedValue(0)
    vi.spyOn(adapter, "cleanupJobs").mockResolvedValue(0)
  })

  describe("removeOnComplete", () => {
    it("should remove completed jobs immediately when true", async () => {
      queue = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: true,
      })

      queue.register("test-job", () => Promise.resolve({ success: true }))

      await queue.connect()
      await queue.add("test-job", { data: "test" })

      queue.start()

      // Wait for job to complete
      await new Promise<void>((resolve) => {
        queue.on("job:completed", () => resolve())
      })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).toHaveBeenCalledWith("completed")
    })

    it("should keep all completed jobs when false", async () => {
      queue = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: false,
      })

      queue.register("test-job", () => Promise.resolve({ success: true }))

      await queue.connect()
      await queue.add("test-job", { data: "test" })

      queue.start()

      // Wait for job to complete
      await new Promise<void>((resolve) => {
        queue.on("job:completed", () => resolve())
      })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).not.toHaveBeenCalled()
    })

    it("should handle number values (existing behavior)", async () => {
      queue = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: 100,
      })

      queue.register("test-job", () => Promise.resolve({ success: true }))

      await queue.connect()
      await queue.add("test-job", { data: "test" })

      queue.start()

      // Wait for job to complete
      await new Promise<void>((resolve) => {
        queue.on("job:completed", () => resolve())
      })

      // Number cleanup logic would need adapter support
      // For now, just verify it doesn't crash
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).not.toHaveBeenCalled()
    })
  })

  describe("removeOnFail", () => {
    it("should remove failed jobs immediately when true", async () => {
      queue = new Queue(adapter, {
        name: "test-queue",
        removeOnFail: true,
      })

      queue.register("failing-job", () => {
        throw new Error("Test failure")
      })

      await queue.connect()
      await queue.add("failing-job", { data: "test" }, { maxAttempts: 1 })

      queue.start()

      // Wait for job to fail
      await new Promise<void>((resolve) => {
        queue.on("job:failed", () => resolve())
      })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).toHaveBeenCalledWith("failed")
    })

    it("should keep all failed jobs when false", async () => {
      queue = new Queue(adapter, {
        name: "test-queue",
        removeOnFail: false,
      })

      queue.register("failing-job", () => {
        throw new Error("Test failure")
      })

      await queue.connect()
      await queue.add("failing-job", { data: "test" }, { maxAttempts: 1 })

      queue.start()

      // Wait for job to fail
      await new Promise<void>((resolve) => {
        queue.on("job:failed", () => resolve())
      })

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).not.toHaveBeenCalled()
    })

    it("should handle number values (existing behavior)", async () => {
      queue = new Queue(adapter, {
        name: "test-queue",
        removeOnFail: 50,
      })

      queue.register("failing-job", () => {
        throw new Error("Test failure")
      })

      await queue.connect()
      await queue.add("failing-job", { data: "test" }, { maxAttempts: 1 })

      queue.start()

      // Wait for job to fail
      await new Promise<void>((resolve) => {
        queue.on("job:failed", () => resolve())
      })

      // Number cleanup logic would need adapter support
      // For now, just verify it doesn't crash
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).not.toHaveBeenCalled()
    })
  })

  describe("mixed cleanup configurations", () => {
    it("should handle different settings for completed and failed jobs", async () => {
      queue = new Queue(adapter, {
        name: "test-queue",
        removeOnComplete: true, // Clean completed immediately
        removeOnFail: false, // Keep all failed jobs
      })

      queue.register("success-job", () => Promise.resolve({ success: true }))
      queue.register("failing-job", () => {
        throw new Error("Test failure")
      })

      await queue.connect()
      await queue.add("success-job", { data: "test" })
      await queue.add("failing-job", { data: "test" }, { maxAttempts: 1 })

      queue.start()

      // Wait for both jobs to complete
      let completedCount = 0
      await new Promise<void>((resolve) => {
        queue.on("job:completed", () => {
          completedCount++
          if (completedCount === 1) resolve()
        })
        queue.on("job:failed", () => {
          completedCount++
          if (completedCount === 1) resolve()
        })
      })

      // Should clean completed but not failed
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).toHaveBeenCalledWith("completed")
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).not.toHaveBeenCalledWith("failed")
    })
  })

  describe("default behavior", () => {
    it("should use default number values when not specified", async () => {
      queue = new Queue(adapter, { name: "test-queue" })

      queue.register("test-job", () => Promise.resolve({ success: true }))

      await queue.connect()
      await queue.add("test-job", { data: "test" })

      queue.start()

      // Wait for job to complete
      await new Promise<void>((resolve) => {
        queue.on("job:completed", () => resolve())
      })

      // Default behavior (number) shouldn't call clearJobs immediately
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(adapter.clearJobs).not.toHaveBeenCalled()
    })
  })

  afterEach(async () => {
    await queue.stop()
    await queue.disconnect()
  })
})
