/**
 * Integration tests for CLI commands via direct transport.
 *
 * Tests the full command flow: transport → action → output.
 */
import { MemoryQueueAdapter } from "@vorsteh-queue/core"
import { beforeEach, describe, expect, it } from "vitest"

import { createDirectTransport } from "../src/transport/direct"
import type { Transport } from "../src/transport/types"

describe("CLI Commands (Direct Transport)", () => {
  let adapter: MemoryQueueAdapter
  let transport: Transport

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    transport = createDirectTransport(adapter, "test-queue")
    await transport.connect()
  })

  describe("getJobs", () => {
    it("should return all jobs", async () => {
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "job-a",
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
        name: "job-b",
        payload: {},
        priority: 1,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "completed",
      })

      const jobs = await transport.getJobs({})
      expect(jobs).toHaveLength(2)
    })

    it("should filter by status", async () => {
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
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "completed-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "completed",
      })

      const jobs = await transport.getJobs({ where: { status: "pending" } })
      expect(jobs).toHaveLength(1)
      expect(jobs[0]?.name).toBe("pending-job")
    })

    it("should respect limit and offset", async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.addJob({
          attempts: 0,
          maxAttempts: 3,
          name: `job-${i}`,
          payload: {},
          priority: 2,
          processAt: new Date(),
          progress: 0,
          repeatCount: 0,
          status: "pending",
        })
      }

      const page1 = await transport.getJobs({ limit: 2, offset: 0 })
      expect(page1).toHaveLength(2)

      const page2 = await transport.getJobs({ limit: 2, offset: 2 })
      expect(page2).toHaveLength(2)

      const page3 = await transport.getJobs({ limit: 2, offset: 4 })
      expect(page3).toHaveLength(1)
    })
  })

  describe("getQueues", () => {
    it("should return the configured queue name", async () => {
      const queues = await transport.getQueues()
      expect(queues).toStrictEqual(["test-queue"])
    })
  })

  describe("cancelJob", () => {
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

      const result = await transport.cancelJob(job.id, "test reason")
      expect(result).toBeTruthy()

      const cancelled = await transport.getJob(job.id)
      expect(cancelled?.status).toBe("cancelled")
      expect(cancelled?.cancellationReason).toBe("test reason")
    })

    it("should return false for completed job", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "done",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "completed",
      })

      const result = await transport.cancelJob(job.id)
      expect(result).toBeFalsy()
    })
  })

  describe("retryJob", () => {
    it("should retry a failed job", async () => {
      const job = await adapter.addJob({
        attempts: 3,
        maxAttempts: 3,
        name: "retry-me",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "failed",
      })

      const result = await transport.retryJob(job.id)
      expect(result).toBeTruthy()

      const retried = await transport.getJob(job.id)
      expect(retried?.status).toBe("pending")
      expect(retried?.attempts).toBe(0)
    })
  })

  describe("runJobNow", () => {
    it("should promote a delayed job", async () => {
      const job = await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "promote-me",
        payload: {},
        priority: 2,
        processAt: new Date(Date.now() + 60_000),
        progress: 0,
        repeatCount: 0,
        status: "delayed",
      })

      const result = await transport.runJobNow(job.id)
      expect(result).toBeTruthy()

      const promoted = await transport.getJob(job.id)
      expect(promoted?.status).toBe("pending")
    })
  })

  describe("deleteJob", () => {
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

      const result = await transport.deleteJob(job.id)
      expect(result).toBeTruthy()

      const deleted = await transport.getJob(job.id)
      expect(deleted).toBeNull()
    })
  })

  describe("clearJobs", () => {
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

      const cleared = await transport.clearJobs()
      expect(cleared).toBe(2)

      const size = await transport.size()
      expect(size).toBe(0)
    })

    it("should clear jobs by status", async () => {
      await adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "keep",
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
        name: "remove",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await adapter.updateJobStatus(completed.id, { status: "completed" })

      const cleared = await transport.clearJobs("completed")
      expect(cleared).toBe(1)
      expect(await transport.size()).toBe(1)
    })
  })
})
