import { beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src"

describe("MemoryQueueAdapter", () => {
  let adapter: MemoryQueueAdapter

  beforeEach(() => {
    adapter = new MemoryQueueAdapter()
    adapter.setQueueName("test-queue")
  })

  it("should connect and disconnect", async () => {
    await adapter.connect()
    await adapter.disconnect()
  })

  it("should add jobs", async () => {
    await adapter.connect()

    const job = await adapter.addJob({
      name: "test-job",
      payload: { data: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    expect(job.id).toBeDefined()
    expect(job.name).toBe("test-job")
    expect(job.createdAt).toBeInstanceOf(Date)
  })

  it("should get next job by priority", async () => {
    await adapter.connect()

    await adapter.addJob({
      name: "low-job",
      payload: {},
      status: "pending",
      priority: 3,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    await adapter.addJob({
      name: "high-job",
      payload: {},
      status: "pending",
      priority: 1,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    const job = await adapter.getNextJob()

    expect(job?.name).toBe("high-job")
  })

  it("should update job status", async () => {
    await adapter.connect()

    const job = await adapter.addJob({
      name: "test-job",
      payload: {},
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    await adapter.updateJobStatus(job.id, "processing")

    const stats = await adapter.getQueueStats()
    expect(stats.processing).toBe(1)
    expect(stats.pending).toBe(0)
  })

  it("should get queue statistics", async () => {
    await adapter.connect()

    await adapter.addJob({
      name: "job1",
      payload: {},
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    await adapter.addJob({
      name: "job2",
      payload: {},
      status: "completed",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    const stats = await adapter.getQueueStats()

    expect(stats.pending).toBe(1)
    expect(stats.completed).toBe(1)
    expect(stats.processing).toBe(0)
    expect(stats.failed).toBe(0)
  })
})
