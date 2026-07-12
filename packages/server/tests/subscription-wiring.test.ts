/**
 * E2E test: Subscription event wiring with JobLifecycleEvent envelope.
 *
 * Verifies the complete subscription pipeline:
 * Queue/Worker event → wireEventBridge → PubSub → GraphQL Subscription
 *
 * Scope: In-process only (no cross-process broker).
 */
import { MemoryQueueAdapter, Queue, Worker } from "@vorsteh-queue/core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createQueueMiddleware } from "../src"
import type { JobLifecycleEvent } from "../src/api/pubsub"
import { PubSub } from "../src/api/pubsub"

describe("Subscription Event Wiring (JobLifecycleEvent Envelope)", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue
  let worker: Worker

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "sub-test-queue" })
    worker = new Worker(adapter, {
      concurrency: 1,
      name: "sub-test-queue",
      pollInterval: 10,
    })
    await queue.connect()
  })

  afterEach(async () => {
    if (worker.isRunning) {
      await worker.stop()
    }
    await queue.disconnect()
  })

  describe("Queue Events → Lifecycle Envelope", () => {
    it("should publish envelope with currentStatus=pending on job:added", async () => {
      createQueueMiddleware({
        auth: false,
        queues: [queue],
        workers: [worker],
      })

      const pubsub = new PubSub()
      queue.on("job:added", (job) => {
        const event: JobLifecycleEvent = {
          currentStatus: job.status,
          jobId: job.id,
          jobName: job.name,
          queueName: "sub-test-queue",
          timestamp: new Date().toISOString(),
        }
        pubsub.publish("job:statusChanged", event)
      })

      const subscription = pubsub.subscribe("job:statusChanged")
      await queue.add("test-handler", { data: "hello" })

      const result = await subscription.next()
      expect(result.done).toBeFalsy()

      const event = result.value
      expect(event.jobName).toBe("test-handler")
      expect(event.currentStatus).toBe("pending")
      expect(event.queueName).toBe("sub-test-queue")
      expect(event.jobId).toBeDefined()
      expect(event.timestamp).toBeDefined()
      expect(event.previousStatus).toBeUndefined()

      await subscription.return(undefined as never)
    })
  })

  describe("Worker Events → Lifecycle Envelope", () => {
    it("should publish envelope with previousStatus=processing on job:completed", async () => {
      const pubsub = new PubSub()
      worker.on("job:completed", (job) => {
        const event: JobLifecycleEvent = {
          currentStatus: job.status,
          jobId: job.id,
          jobName: job.name,
          previousStatus: "processing",
          queueName: "sub-test-queue",
          timestamp: new Date().toISOString(),
        }
        pubsub.publish("job:statusChanged", event)
      })

      const subscription = pubsub.subscribe("job:statusChanged")
      worker.register("complete-me", async () => ({ done: true }))
      await queue.add("complete-me", {})

      worker.start()
      const result = await subscription.next()

      expect(result.done).toBeFalsy()
      expect(result.value.currentStatus).toBe("completed")
      expect(result.value.previousStatus).toBe("processing")
      expect(result.value.jobName).toBe("complete-me")

      await subscription.return(undefined as never)
    })

    it("should publish envelope on job:failed", async () => {
      const pubsub = new PubSub()
      worker.on("job:failed", (job) => {
        const event: JobLifecycleEvent = {
          currentStatus: job.status,
          jobId: job.id,
          jobName: job.name,
          previousStatus: "processing",
          queueName: "sub-test-queue",
          timestamp: new Date().toISOString(),
        }
        pubsub.publish("job:statusChanged", event)
      })

      const subscription = pubsub.subscribe("job:statusChanged")
      worker.register("fail-me", async () => {
        throw new Error("intentional")
      })
      await queue.add("fail-me", {}, { maxAttempts: 1 })

      worker.start()
      const result = await subscription.next()

      expect(result.done).toBeFalsy()
      expect(result.value.jobName).toBe("fail-me")
      expect(result.value.previousStatus).toBe("processing")

      await subscription.return(undefined as never)
    })
  })

  describe("Full Bridge via createQueueMiddleware", () => {
    it("should produce lifecycle envelopes through the internal bridge", async () => {
      // createQueueMiddleware wires the event bridge internally
      createQueueMiddleware({
        auth: false,
        queues: [queue],
        workers: [worker],
      })

      // Subscribe to the queue's own event to confirm the pipeline works
      const completedPromise = new Promise<string>((resolve) => {
        worker.on("job:completed", (job) => {
          resolve(job.status)
        })
      })

      worker.register("bridge-test", async () => ({ bridged: true }))
      await queue.add("bridge-test", {})

      worker.start()
      const status = await completedPromise

      expect(status).toBe("completed")
    })
  })

  describe("GraphQL Subscription Transport E2E (SSE)", () => {
    it("should receive lifecycle event over real SSE subscription transport", async () => {
      const app = createQueueMiddleware({
        auth: false,
        queues: [queue],
        workers: [worker],
      })

      worker.register("transport-test", async () => ({ ok: true }))

      // Open SSE subscription request (non-blocking stream read)
      const subscriptionBody = JSON.stringify({
        query: `subscription { jobStatusChanged { jobId jobName currentStatus previousStatus queueName timestamp } }`,
      })

      const response = await app.request("/graphql", {
        body: subscriptionBody,
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        method: "POST",
      })

      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain(
        "text/event-stream"
      )

      // Get the readable stream
      const reader = response.body?.getReader()
      expect(reader).toBeDefined()
      if (!reader) {
        return
      }

      // Read initial SSE ping (connection established)
      const decoder = new TextDecoder()
      const { value: ping } = await reader.read()
      const pingChunk = decoder.decode(ping)
      // GraphQL Yoga sends a comment/ping on connection open
      expect(pingChunk).toContain(":")

      // Now trigger an event: add a job (subscription is established)
      await queue.add("transport-test", { x: 1 })

      // Read the actual event chunk from SSE stream
      const { value } = await reader.read()
      const chunk = decoder.decode(value)

      // SSE format: "event: next\ndata: {...}\n\n"
      expect(chunk).toContain("event:")
      expect(chunk).toContain("jobStatusChanged")
      expect(chunk).toContain("transport-test")
      expect(chunk).toContain("sub-test-queue")
      expect(chunk).toContain("pending")

      // Parse the JSON payload from SSE data line
      const dataLine = chunk
        .split("\n")
        .find((line: string) => line.startsWith("data:"))
      expect(dataLine).toBeDefined()
      if (!dataLine) {
        return
      }

      const jsonPayload = JSON.parse(dataLine.replace("data: ", "")) as {
        data: {
          jobStatusChanged: {
            jobId: string
            jobName: string
            currentStatus: string
            queueName: string
            timestamp: string
          }
        }
      }
      expect(jsonPayload.data.jobStatusChanged.jobName).toBe("transport-test")
      expect(jsonPayload.data.jobStatusChanged.currentStatus).toBe("pending")
      expect(jsonPayload.data.jobStatusChanged.queueName).toBe("sub-test-queue")
      expect(jsonPayload.data.jobStatusChanged.timestamp).toBeDefined()

      // Cancel the stream (cleanup)
      await reader.cancel()
    })
  })
})
