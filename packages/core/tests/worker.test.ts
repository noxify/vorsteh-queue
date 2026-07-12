import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import type { JobContext, JobWithProgress } from "../src/types"
import { Worker } from "../src/worker"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("Worker (Consumer)", () => {
  let adapter: MemoryQueueAdapter
  let worker: Worker

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    await adapter.connect()
    adapter.setQueueName("test-queue")
    worker = new Worker(adapter, {
      concurrency: 2,
      name: "test-queue",
      pollInterval: 10,
    })
  })

  afterEach(async () => {
    if (worker.isRunning) {
      await worker.stop()
    }
  })

  describe("register / registerBatch", () => {
    it("should register a handler", () => {
      expect(() =>
        worker.register("test", async () => ({ ok: true }))
      ).not.toThrow()
    })

    it("should throw on duplicate handler name", () => {
      worker.register("test", async () => ({}))
      expect(() => worker.register("test", async () => ({}))).toThrow(
        'Handler for "test" is already registered'
      )
    })

    it("should throw when single and batch names conflict", () => {
      worker.register("job", async () => ({}))
      expect(() => worker.registerBatch("job", async () => [])).toThrow(
        "already registered"
      )
    })
  })

  describe("start / stop / pause / resume", () => {
    it("should emit worker:started on start", async () => {
      const listener = vi.fn<() => void>()
      worker.on("worker:started", listener)

      worker.register("x", async () => ({}))
      worker.start()

      expect(listener).toHaveBeenCalledOnce()
      expect(worker.isRunning).toBeTruthy()
    })

    it("should emit worker:stopped on stop", async () => {
      const listener = vi.fn<() => void>()
      worker.on("worker:stopped", listener)

      worker.register("x", async () => ({}))
      worker.start()
      await worker.stop()

      expect(listener).toHaveBeenCalledOnce()
      expect(worker.isRunning).toBeFalsy()
    })

    it("should not pick jobs when paused", async () => {
      const handler = vi
        .fn<(job: JobWithProgress, ctx: JobContext) => Promise<unknown>>()
        .mockResolvedValue({})
      worker.register("test-job", handler)

      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "test-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      // Start and immediately pause before poll loop runs
      worker.start()
      worker.pause()
      await wait(80)

      expect(handler).not.toHaveBeenCalled()

      worker.resume()
      await wait(80)

      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe("job processing", () => {
    it("should process a pending job", async () => {
      const handler = vi
        .fn<(job: JobWithProgress, ctx: JobContext) => Promise<unknown>>()
        .mockResolvedValue({ done: true })
      worker.register("test-job", handler)

      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "test-job",
        payload: { x: 1 },
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(50)

      expect(handler).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ payload: { x: 1 } }),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it("should emit job:completed on success", async () => {
      const listener = vi.fn<() => void>()
      worker.on("job:completed", listener)
      worker.register("test-job", async () => ({ result: true }))

      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "test-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(50)

      expect(listener).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          result: { result: true },
          status: "completed",
        })
      )
    })

    it("should update progress via job.updateProgress()", async () => {
      const progressListener = vi.fn<() => void>()
      worker.on("job:progress", progressListener)

      worker.register("progress-job", async (job: JobWithProgress) => {
        await job.updateProgress(50)
        await job.updateProgress(100)
        return {}
      })

      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "progress-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(50)

      expect(progressListener).toHaveBeenCalledTimes(2)
    })
  })

  describe("retry / DLQ", () => {
    it("should retry failed job (move to delayed)", async () => {
      const retriedListener = vi.fn<() => void>()
      worker.on("job:retried", retriedListener)

      let callCount = 0
      worker.register("failing", async () => {
        callCount += 1
        if (callCount === 1) {
          throw new Error("fail once")
        }
        return { ok: true }
      })

      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "failing",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(50)

      expect(retriedListener).toHaveBeenCalledOnce()
      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("delayed")
    })

    it("should move to dead after maxAttempts exceeded", async () => {
      const deadListener = vi.fn<() => void>()
      worker.on("job:dead", deadListener)

      worker.register("always-fails", async () => {
        throw new Error("always fails")
      })

      const job = await adapter.addJob({
        attempts: 2, // already tried twice
        maxAttempts: 3,
        name: "always-fails",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(50)

      expect(deadListener).toHaveBeenCalledOnce()
      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("dead")
    })
  })

  describe("timeout", () => {
    it("should abort job after timeout", async () => {
      const failedListener = vi.fn<() => void>()
      worker.on("job:failed", failedListener)

      worker.register(
        "slow-job",
        async (_job: JobWithProgress, { signal }: JobContext) => {
          // eslint-disable-next-line promise/avoid-new
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 5000)
            signal.addEventListener("abort", () => {
              clearTimeout(timer)
              reject(new Error("aborted"))
            })
          })
          return {}
        }
      )

      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "slow-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
        timeout: 20,
      })

      worker.start()
      await wait(100)

      expect(failedListener).toHaveBeenCalledOnce()
    })
  })

  describe("cancellation", () => {
    it("should cancel an active job via cancelJob()", async () => {
      const cancelledListener = vi.fn<() => void>()
      worker.on("job:cancelled", cancelledListener)

      worker.register(
        "long-job",
        async (_job: JobWithProgress, { signal }: JobContext) => {
          // eslint-disable-next-line promise/avoid-new
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 5000)
            signal.addEventListener("abort", () => {
              clearTimeout(timer)
              reject(new Error("cancelled"))
            })
          })
          return {}
        }
      )

      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "long-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(30) // let it start processing

      await worker.cancelJob(job.id, "user requested")
      await wait(30)

      expect(cancelledListener).toHaveBeenCalledOnce()
    })
  })

  describe("group FIFO", () => {
    it("should not process two jobs in the same group concurrently", async () => {
      const concurrentGroups = new Set<string>()
      let maxConcurrent = 0

      worker.register("grouped", async (job: JobWithProgress) => {
        const group = job.groupKey ?? "none"
        concurrentGroups.add(group)
        maxConcurrent = Math.max(maxConcurrent, concurrentGroups.size)
        await wait(30)
        concurrentGroups.delete(group)
        return {}
      })

      // Add 2 jobs with same group
      await adapter.addJob({
        attempts: 0,
        groupKey: "group-a",
        maxAttempts: 3,
        name: "grouped",
        payload: { n: 1 },
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.addJob({
        attempts: 0,
        groupKey: "group-a",
        maxAttempts: 3,
        name: "grouped",
        payload: { n: 2 },
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(120)

      // Only 1 group-a job should run at a time
      expect(maxConcurrent).toBe(1)
    })
  })

  describe("cron / recurring", () => {
    it("should schedule next run after completing a cron job", async () => {
      worker.register("cron-job", async () => ({ done: true }))

      await adapter.addJob({
        attempts: 0,
        cron: "0 9 * * *",
        maxAttempts: 3,
        name: "cron-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      worker.start()
      await wait(50)

      const stats = await adapter.getQueueStats()
      // Original job completed + new delayed job scheduled
      expect(stats.delayed).toBeGreaterThanOrEqual(1)
    })

    it("should not schedule next run if repeatLimit reached", async () => {
      worker.register("limited", async () => ({ done: true }))

      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "limited",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 5,
        repeatEvery: 1000,
        repeatLimit: 5,
        status: "pending",
      })

      worker.start()
      await wait(50)

      const stats = await adapter.getQueueStats()
      expect(stats.delayed).toBe(0)
    })
  })
})
