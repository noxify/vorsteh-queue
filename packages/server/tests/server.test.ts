import { MemoryQueueAdapter } from "@vorsteh-queue/core"
import { beforeEach, describe, expect, it } from "vitest"

import { createQueueMiddleware } from "../src"

describe("GraphQL Server", () => {
  let adapter: MemoryQueueAdapter

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    await adapter.connect()
    adapter.setQueueName("test-queue")
  })

  function createApp() {
    return createQueueMiddleware({
      adapter,
      queueName: "test-queue",
      auth: false,
    })
  }

  describe("health check", () => {
    it("should respond with status ok", async () => {
      const app = createApp()
      const res = await app.request("/health")
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toStrictEqual({ status: "ok", queueName: "test-queue" })
    })
  })

  describe("GraphQL queries", () => {
    it("should return queue stats", async () => {
      const app = createApp()

      // Add some jobs
      await adapter.addJob({
        name: "test",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "{ stats { pending completed failed } }",
        }),
      })

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.stats.pending).toBe(1)
      expect(body.data.stats.completed).toBe(0)
    })

    it("should get a job by ID", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "lookup-job",
        payload: { key: "value" },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{ job(id: "${job.id}") { id name status priority payload } }`,
        }),
      })

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.job.id).toBe(job.id)
      expect(body.data.job.name).toBe("lookup-job")
      expect(body.data.job.status).toBe("pending")
    })

    it("should return null for unknown job", async () => {
      const app = createApp()

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: '{ job(id: "unknown") { id } }',
        }),
      })

      const body = await res.json()
      expect(body.data.job).toBeNull()
    })

    it("should get dead jobs", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "dead-job",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })
      await adapter.updateJobStatus(job.id, { status: "dead" })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "{ deadJobs { id name status } }",
        }),
      })

      const body = await res.json()
      expect(body.data.deadJobs).toHaveLength(1)
      expect(body.data.deadJobs[0].status).toBe("dead")
    })

    it("should return queue size", async () => {
      const app = createApp()

      await adapter.addJob({
        name: "a",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "{ size }" }),
      })

      const body = await res.json()
      expect(body.data.size).toBe(1)
    })
  })

  describe("GraphQL mutations", () => {
    it("should cancel a job", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "cancel-me",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation { cancelJob(id: "${job.id}", reason: "test") }`,
        }),
      })

      const body = await res.json()
      expect(body.data.cancelJob).toBeTruthy()

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("cancelled")
    })

    it("should redrive a dead job", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "redrive-me",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 3,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })
      await adapter.updateJobStatus(job.id, { status: "dead" })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation { redriveJob(id: "${job.id}") }`,
        }),
      })

      const body = await res.json()
      expect(body.data.redriveJob).toBeTruthy()

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
    })

    it("should clear jobs by status", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "clear-me",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })
      await adapter.updateJobStatus(job.id, { status: "completed" })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "mutation { clearJobs(status: completed) }",
        }),
      })

      const body = await res.json()
      expect(body.data.clearJobs).toBe(1)
    })

    it("should retry a failed job", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "retry-me",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 2,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })
      await adapter.updateJobStatus(job.id, {
        status: "failed",
        error: { name: "Error", message: "oops" },
      })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation { retryJob(id: "${job.id}") }`,
        }),
      })

      const body = await res.json()
      expect(body.data.retryJob).toBeTruthy()

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
      expect(updated?.attempts).toBe(0)
    })

    it("should promote a delayed job via runJobNow", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "delayed-job",
        payload: {},
        status: "delayed",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(Date.now() + 60_000),
        progress: 0,
        repeatCount: 0,
      })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation { runJobNow(id: "${job.id}") }`,
        }),
      })

      const body = await res.json()
      expect(body.data.runJobNow).toBeTruthy()

      const updated = await adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
    })

    it("should delete a job", async () => {
      const app = createApp()

      const job = await adapter.addJob({
        name: "delete-me",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
      })

      const res = await app.request("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation { deleteJob(id: "${job.id}") }`,
        }),
      })

      const body = await res.json()
      expect(body.data.deleteJob).toBeTruthy()

      const found = await adapter.getJobById(job.id)
      expect(found).toBeNull()
    })
  })

  describe("authentication", () => {
    it("should reject requests without token", async () => {
      const app = createQueueMiddleware({
        adapter,
        queueName: "test-queue",
        auth: { tokens: ["secret-token"] },
      })

      const res = await app.request("/health")
      expect(res.status).toBe(401)
    })

    it("should accept requests with valid token", async () => {
      const app = createQueueMiddleware({
        adapter,
        queueName: "test-queue",
        auth: { tokens: ["secret-token"] },
      })

      const res = await app.request("/health", {
        headers: { Authorization: "Bearer secret-token" },
      })
      expect(res.status).toBe(200)
    })

    it("should reject requests with invalid token", async () => {
      const app = createQueueMiddleware({
        adapter,
        queueName: "test-queue",
        auth: { tokens: ["secret-token"] },
      })

      const res = await app.request("/health", {
        headers: { Authorization: "Bearer wrong-token" },
      })
      expect(res.status).toBe(401)
    })
  })
})
