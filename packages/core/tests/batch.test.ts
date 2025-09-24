import { beforeEach, describe, expect, it } from "vitest"

import type { BaseJob } from "../types"
import { MemoryQueueAdapter } from "../src/adapters/memory"
import { Queue } from "../src/core/queue"

describe("Queue Batch Processing", () => {
  let queue: Queue
  let adapter: MemoryQueueAdapter

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "batch-test", batch: { minSize: 2, maxSize: 5 } })
    await queue.connect()
  })

  it("should process jobs in batches with the batch handler", async () => {
    const processedBatches: BaseJob[][] = []
    queue.registerBatch("batch-job", (jobs) => {
      processedBatches.push(jobs.map((j) => ({ ...j })))
      // Simulate result array
      return jobs.map((j) => ({ ok: true, id: j.id }))
    })

    // Add 4 jobs
    await queue.addJobs("batch-job", [{ foo: 1 }, { foo: 2 }, { foo: 3 }, { foo: 4 }])

    queue.start()
    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Should process in one batch of 4 (minSize: 2, maxSize: 5)
    expect(processedBatches.length).toBe(1)
    expect(processedBatches[0]?.length).toBe(4)
    expect(processedBatches[0]?.every((j) => j.name === "batch-job")).toBe(true)
  })

  it("should emit batch events", async () => {
    const events: string[] = []
    queue.on("batch:processing", () => {
      events.push("processing")
    })
    queue.on("batch:completed", () => {
      events.push("completed")
    })
    queue.registerBatch("batch-job", () => Promise.resolve([]))
    await queue.addJobs("batch-job", [{ foo: 1 }, { foo: 2 }])
    queue.start()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(events).toEqual(["processing", "completed"])
  })

  it("should handle batch handler errors and emit batch:failed", async () => {
    let failedEvent: unknown = null
    queue.on("batch:failed", (data: unknown) => {
      failedEvent = data
    })
    queue.registerBatch("batch-job", () => {
      throw new Error("batch fail")
    })
    await queue.addJobs("batch-job", [{ foo: 1 }, { foo: 2 }])
    queue.start()
    await new Promise((resolve) => setTimeout(resolve, 50))
    let jobs: BaseJob[] = []
    if (
      failedEvent &&
      typeof failedEvent === "object" &&
      "jobs" in failedEvent &&
      Array.isArray((failedEvent as Record<string, unknown>).jobs)
    ) {
      jobs = (failedEvent as { jobs: BaseJob[] }).jobs
    }
    expect(jobs.length).toBe(2)
    expect(failedEvent && typeof failedEvent === "object" && "error" in failedEvent).toBe(true)
  })

  it("should not process jobs in batch if below minSize", async () => {
    const processedBatches: BaseJob[][] = []
    queue.registerBatch("batch-job", (jobs) => {
      processedBatches.push(jobs.map((j) => ({ ...j })))
      return Promise.resolve([])
    })
    await queue.addJobs("batch-job", [{ foo: 1 }])
    queue.start()
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(processedBatches.length).toBe(0)
  })
})
