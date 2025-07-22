import { beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter, Queue } from "../src"
import { waitFor } from "../src/utils/helpers"

describe("Job Timeout", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(() => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, {
      name: "timeout-test-queue",
      pollInterval: 10,
      jobInterval: 1,
    })
  })

  it("should timeout jobs that exceed the default timeout", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms delay
      return { completed: true }
    })
    const failedSpy = vi.fn()

    queue.register("slow-job", handler)
    queue.on("job:failed", failedSpy)

    await queue.connect()
    await queue.add("slow-job", { data: "test" }, { timeout: 50 }) // 50ms timeout
    queue.start()

    await waitFor(200)

    expect(handler).toHaveBeenCalled()
    expect(failedSpy).toHaveBeenCalled()

    const failedJob = failedSpy.mock.calls[0]?.[0] as { error: { message: string } }
    expect(failedJob.error.message).toBe("Job timeout")

    await queue.stop()
  })

  it("should complete jobs within timeout", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50)) // 50ms delay
      return { completed: true }
    })
    const completedSpy = vi.fn()

    queue.register("fast-job", handler)
    queue.on("job:completed", completedSpy)

    await queue.connect()
    await queue.add("fast-job", { data: "test" }, { timeout: 100 }) // 100ms timeout
    queue.start()

    await waitFor(200)

    expect(handler).toHaveBeenCalled()
    expect(completedSpy).toHaveBeenCalled()

    const completedJob = completedSpy.mock.calls[0]?.[0] as { result: unknown }
    expect(completedJob.result).toEqual({ completed: true })

    await queue.stop()
  })

  it("should disable timeout when timeout is false", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms delay
      return { completed: true }
    })
    const completedSpy = vi.fn()
    const failedSpy = vi.fn()

    queue.register("no-timeout-job", handler)
    queue.on("job:completed", completedSpy)
    queue.on("job:failed", failedSpy)

    await queue.connect()
    await queue.add("no-timeout-job", { data: "test" }, { timeout: false })
    queue.start()

    await waitFor(200)

    expect(handler).toHaveBeenCalled()
    expect(completedSpy).toHaveBeenCalled()
    expect(failedSpy).not.toHaveBeenCalled()

    const completedJob = completedSpy.mock.calls[0]?.[0] as { result: unknown }
    expect(completedJob.result).toEqual({ completed: true })

    await queue.stop()
  })

  it("should use default timeout when not specified", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100)) // 100ms delay
      return { completed: true }
    })
    const failedSpy = vi.fn()

    // Set default timeout to 50ms
    const queueWithTimeout = new Queue(adapter, {
      name: "default-timeout-queue",
      defaultJobOptions: { timeout: 50 },
      pollInterval: 10,
      jobInterval: 1,
    })

    queueWithTimeout.register("default-timeout-job", handler)
    queueWithTimeout.on("job:failed", failedSpy)

    await queueWithTimeout.connect()
    await queueWithTimeout.add("default-timeout-job", { data: "test" }) // No timeout specified
    queueWithTimeout.start()

    await waitFor(200)

    expect(handler).toHaveBeenCalled()
    expect(failedSpy).toHaveBeenCalled()

    const failedJob = failedSpy.mock.calls[0]?.[0] as { error: { message: string } }
    expect(failedJob.error.message).toBe("Job timeout")

    await queueWithTimeout.stop()
  })

  it("should override default timeout with job-specific timeout", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 75)) // 75ms delay
      return { completed: true }
    })
    const completedSpy = vi.fn()

    // Set default timeout to 50ms
    const queueWithTimeout = new Queue(adapter, {
      name: "override-timeout-queue",
      defaultJobOptions: { timeout: 50 },
      pollInterval: 10,
      jobInterval: 1,
    })

    queueWithTimeout.register("override-timeout-job", handler)
    queueWithTimeout.on("job:completed", completedSpy)

    await queueWithTimeout.connect()
    await queueWithTimeout.add("override-timeout-job", { data: "test" }, { timeout: 100 }) // Override with 100ms
    queueWithTimeout.start()

    await waitFor(200)

    expect(handler).toHaveBeenCalled()
    expect(completedSpy).toHaveBeenCalled()

    await queueWithTimeout.stop()
  })
})
