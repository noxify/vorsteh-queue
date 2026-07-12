import { MemoryQueueAdapter, Queue } from "@vorsteh-queue/core"
import { beforeEach, describe, expect, it } from "vitest"

import { createQueueMiddleware } from "../src"

describe("GraphQL Server", () => {
  let queue: Queue

  beforeEach(async () => {
    const adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "test-queue" })
    await queue.connect()
  })

  function createApp() {
    return createQueueMiddleware({
      auth: false,
      queues: [queue],
    })
  }

  describe("health check", () => {
    it("should respond with status ok", async () => {
      const app = createApp()
      const res = await app.request("/health")
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toStrictEqual({ queues: ["test-queue"], status: "ok" })
    })
  })

  describe("GraphQL queries", () => {
    it("should return queue stats", async () => {
      const app = createApp()

      // Add some jobs
      await queue.adapter.addJob({
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

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: '{ stats(queue: "test-queue") { pending completed failed } }',
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.stats.pending).toBe(1)
      expect(body.data.stats.completed).toBe(0)
    })

    it("should reject unknown queue name", async () => {
      const app = createApp()

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: '{ stats(queue: "unknown-queue") { pending } }',
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.errors).toBeDefined()
      expect(body.errors[0].message).toContain(
        "Queue 'unknown-queue' not found"
      )
    })

    it("should get a job by ID with queue", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "lookup-job",
        payload: { key: "value" },
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `{ job(id: "${job.id}", queue: "test-queue") { id name status priority payload } }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.job.id).toBe(job.id)
      expect(body.data.job.name).toBe("lookup-job")
      expect(body.data.job.status).toBe("pending")
    })

    it("should get a job by ID without queue (search all)", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "lookup-job",
        payload: { key: "value" },
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `{ job(id: "${job.id}") { id name status } }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.job.id).toBe(job.id)
      expect(body.data.job.name).toBe("lookup-job")
    })

    it("should return null for unknown job", async () => {
      const app = createApp()

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: '{ job(id: "unknown") { id } }',
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.job).toBeNull()
    })

    it("should get dead jobs", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "dead-job",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await queue.adapter.updateJobStatus(job.id, { status: "dead" })

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: '{ deadJobs(queue: "test-queue") { id name status } }',
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.deadJobs).toHaveLength(1)
      expect(body.data.deadJobs[0].status).toBe("dead")
    })

    it("should return queue size", async () => {
      const app = createApp()

      await queue.adapter.addJob({
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

      const res = await app.request("/graphql", {
        body: JSON.stringify({ query: '{ size(queue: "test-queue") }' }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.size).toBe(1)
    })
  })

  describe("GraphQL mutations", () => {
    it("should cancel a job", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
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

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `mutation { cancelJob(id: "${job.id}", queue: "test-queue", reason: "test") }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.cancelJob).toBeTruthy()

      const updated = await queue.adapter.getJobById(job.id)
      expect(updated?.status).toBe("cancelled")
    })

    it("should redrive a dead job", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
        attempts: 3,
        maxAttempts: 3,
        name: "redrive-me",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await queue.adapter.updateJobStatus(job.id, { status: "dead" })

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `mutation { redriveJob(id: "${job.id}", queue: "test-queue") }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.redriveJob).toBeTruthy()

      const updated = await queue.adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
    })

    it("should clear jobs by status", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
        attempts: 0,
        maxAttempts: 3,
        name: "clear-me",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await queue.adapter.updateJobStatus(job.id, { status: "completed" })

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query:
            'mutation { clearJobs(queue: "test-queue", status: completed) }',
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.clearJobs).toBe(1)
    })

    it("should retry a failed job", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
        attempts: 2,
        maxAttempts: 3,
        name: "retry-me",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })
      await queue.adapter.updateJobStatus(job.id, {
        error: { message: "oops", name: "Error" },
        status: "failed",
      })

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `mutation { retryJob(id: "${job.id}", queue: "test-queue") }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.retryJob).toBeTruthy()

      const updated = await queue.adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
      expect(updated?.attempts).toBe(0)
    })

    it("should promote a delayed job via runJobNow", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
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

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `mutation { runJobNow(id: "${job.id}", queue: "test-queue") }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.runJobNow).toBeTruthy()

      const updated = await queue.adapter.getJobById(job.id)
      expect(updated?.status).toBe("pending")
    })

    it("should delete a job", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
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

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `mutation { deleteJob(id: "${job.id}", queue: "test-queue") }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.data.deleteJob).toBeTruthy()

      const found = await queue.adapter.getJobById(job.id)
      expect(found).toBeNull()
    })

    it("should reject mutation with unknown queue", async () => {
      const app = createApp()

      const job = await queue.adapter.addJob({
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

      const res = await app.request("/graphql", {
        body: JSON.stringify({
          query: `mutation { deleteJob(id: "${job.id}", queue: "invalid-queue") }`,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })

      const body = await res.json()
      expect(body.errors).toBeDefined()
      expect(body.errors[0].message).toContain(
        "Queue 'invalid-queue' not found"
      )
    })
  })

  describe("authentication", () => {
    it("should reject requests without token", async () => {
      const app = createQueueMiddleware({
        auth: { tokens: ["secret-token"] },
        queues: [queue],
      })

      const res = await app.request("/health")
      expect(res.status).toBe(401)
    })

    it("should accept requests with valid token", async () => {
      const app = createQueueMiddleware({
        auth: { tokens: ["secret-token"] },
        queues: [queue],
      })

      const res = await app.request("/health", {
        headers: { Authorization: "Bearer secret-token" },
      })
      expect(res.status).toBe(200)
    })

    it("should reject requests with invalid token", async () => {
      const app = createQueueMiddleware({
        auth: { tokens: ["secret-token"] },
        queues: [queue],
      })

      const res = await app.request("/health", {
        headers: { Authorization: "Bearer wrong-token" },
      })
      expect(res.status).toBe(401)
    })
  })
})
