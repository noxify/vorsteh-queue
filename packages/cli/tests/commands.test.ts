import { MemoryQueueAdapter } from "@vorsteh-queue/core"
import { beforeEach, describe, expect, it } from "vitest"

import { createDirectTransport } from "../src/transport/direct"
import type { Transport } from "../src/transport/types"

describe("CLI Transport (direct)", () => {
  let adapter: MemoryQueueAdapter
  let transport: Transport

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    transport = createDirectTransport(adapter, "test-queue")
    await transport.connect()
  })

  describe("status", () => {
    it("should return queue stats", async () => {
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "test",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const stats = await transport.getStats()
      expect(stats.pending).toBe(1)
    })

    it("should return queue size", async () => {
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "test",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const size = await transport.size()
      expect(size).toBe(1)
    })
  })

  describe("inspect", () => {
    it("should get a job by ID", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "inspect-me",
        payload: { data: "hello" },
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const result = await transport.getJob(job.id)
      expect(result?.name).toBe("inspect-me")
      expect(result?.payload).toStrictEqual({ data: "hello" })
    })

    it("should return null for unknown job", async () => {
      const result = await transport.getJob("nonexistent")
      expect(result).toBeNull()
    })
  })

  describe("cancel", () => {
    it("should cancel a pending job", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "cancel-me",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const success = await transport.cancelJob(job.id, "test reason")
      expect(success).toBeTruthy()

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("cancelled")
      expect(updated?.cancellationReason).toBe("test reason")
    })
  })

  describe("redrive", () => {
    it("should redrive a dead job", async () => {
      const job = await adapter.addJob({
        attempts: 3,
        maxAttempts: 3,
        name: "dead-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.updateJobStatus(job.id, { status: "dead" })

      await transport.redriveJob(job.id)

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
    })

    it("should redrive all dead jobs", async () => {
      const j1 = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "dead-1",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      const j2 = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "dead-2",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.updateJobStatus(j1.id, { status: "dead" })
      await adapter.updateJobStatus(j2.id, { status: "dead" })

      const count = await transport.redriveAll()
      expect(count).toBe(2)
    })
  })

  describe("clear", () => {
    it("should clear all jobs", async () => {
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "a",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "b",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const count = await transport.clearJobs()
      expect(count).toBe(2)
    })

    it("should clear jobs by status", async () => {
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "pending-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      const completed = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "done-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.updateJobStatus(completed.id, { status: "completed" })

      const count = await transport.clearJobs("completed")
      expect(count).toBe(1)

      const remaining = await transport.size()
      expect(remaining).toBe(1)
    })
  })

  describe("dead jobs", () => {
    it("should list dead jobs", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "dead",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.updateJobStatus(job.id, { status: "dead" })

      const deadJobs = await transport.getDeadJobs()
      expect(deadJobs).toHaveLength(1)
      expect(deadJobs[0]?.id).toBe(job.id)
    })
  })

  describe("retry", () => {
    it("should retry a failed job", async () => {
      const job = await adapter.addJob({
        attempts: 2,
        maxAttempts: 3,
        name: "failed-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.updateJobStatus(job.id, { status: "failed" })

      const success = await transport.retryJob(job.id)
      expect(success).toBeTruthy()

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
    })

    it("should not retry a non-failed job", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "pending-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const success = await transport.retryJob(job.id)
      expect(success).toBeFalsy()
    })
  })

  describe("run now", () => {
    it("should promote a delayed job", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "delayed-job",
        payload: {},
        priority: 2,
        processAt: new Date(Date.now() + 60_000),
        progress: 0,
        repeatCount: 0,
        status: "delayed",
      })

      const success = await transport.runJobNow(job.id)
      expect(success).toBeTruthy()

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
    })
  })

  describe("delete", () => {
    it("should delete a job", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "delete-me",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const success = await transport.deleteJob(job.id)
      expect(success).toBeTruthy()

      const found = await adapter.getJobById(job.id)
      expect(found).toBeNull()
    })

    it("should return false for non-existent job", async () => {
      const success = await transport.deleteJob("nonexistent")
      expect(success).toBeFalsy()
    })
  })
})
