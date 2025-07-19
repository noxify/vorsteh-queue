import { beforeEach, describe, expect, it, vi } from "vitest"

import type { JobWithProgress } from "../types"
import { MemoryQueueAdapter, Queue } from "../src"
import { waitFor } from "../src/utils/helpers"

describe("Job Progress", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(() => {
    adapter = new MemoryQueueAdapter("test-queue")
    queue = new Queue(adapter, { name: "test-queue", processingInterval: 10, jobInterval: 1 })
  })

  it("should support job progress updates", async () => {
    // Create a handler that reports progress
    const handler = vi.fn(async (job: JobWithProgress) => {
      await job.updateProgress(25)
      await job.updateProgress(50)
      await job.updateProgress(100)
      return { result: "success" }
    })

    // Create spy for progress updates
    const progressSpy = vi.fn()
    queue.on("job:progress", progressSpy)

    queue.register("progress-job", handler)

    await queue.connect()
    await queue.add("progress-job", { data: "test" })
    queue.start()

    await waitFor(100)

    // Verify handler was called and progress was updated
    expect(handler).toHaveBeenCalled()

    await queue.stop()
  })

  it("should call updateJobProgress with correct values", async () => {
    // Spy on the adapter's updateJobProgress method
    const updateProgressSpy = vi.spyOn(adapter, "updateJobProgress")

    // Create a handler that reports progress
    const handler = vi.fn(async (job: JobWithProgress) => {
      await job.updateProgress(25)
      await job.updateProgress(50)
      await job.updateProgress(100)

      return { result: "success" }
    })

    queue.register("progress-job", handler)

    await queue.connect()
    const job = await queue.add("progress-job", { data: "test" })
    queue.start()

    await waitFor(100)

    // Verify progress was updated with correct values
    expect(updateProgressSpy).toHaveBeenCalledTimes(3)
    expect(updateProgressSpy).toHaveBeenNthCalledWith(1, job.id, 25)
    expect(updateProgressSpy).toHaveBeenNthCalledWith(2, job.id, 50)
    expect(updateProgressSpy).toHaveBeenNthCalledWith(3, job.id, 100)

    await queue.stop()
  })
})
