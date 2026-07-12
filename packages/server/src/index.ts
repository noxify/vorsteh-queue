/**
 * vorsteh-queue/server
 *
 * GraphQL API server for monitoring and managing vorsteh-queue jobs.
 * Can run standalone or as Hono middleware.
 *
 * @example
 * ```typescript
 * import { createQueueServer } from "@vorsteh-queue/server"
 * import { Queue, MemoryQueueAdapter } from "@vorsteh-queue/core"
 *
 * const adapter = new MemoryQueueAdapter()
 * const queue = new Queue(adapter, { name: "my-queue" })
 *
 * const server = createQueueServer({
 *   queues: [queue],
 *   auth: { tokens: [process.env.QUEUE_TOKEN] },
 * })
 *
 * await server.start()
 * ```
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { createQueueMiddleware } from "@vorsteh-queue/server"
 *
 * const app = new Hono()
 * app.route("/queue", createQueueMiddleware({
 *   queues: [queue],
 * }))
 * ```
 */

import { serve } from "@hono/node-server"
import type { Job, JobStatus } from "@vorsteh-queue/core"
import { createYoga } from "graphql-yoga"
import { Hono } from "hono"

import { createAuthMiddleware } from "./api/auth"
import { PubSub } from "./api/pubsub"
import type { JobLifecycleEvent } from "./api/pubsub"
import type { SchemaContext } from "./api/schema"
import { schema } from "./api/schema"
import type { ServerConfig } from "./config"

export type { AuthConfig, ServerConfig } from "./config"
export { defineConfig, loadConfig } from "./config"
export { createAuthMiddleware } from "./api/auth"
export { PubSub } from "./api/pubsub"
export type { PubSubEvents, JobLifecycleEvent } from "./api/pubsub"

/**
 * Create a Hono app configured as a queue management API middleware.
 * Can be mounted on an existing Hono app via `app.route()`.
 *
 * @param config - Server configuration
 * @returns Hono app instance with GraphQL API routes
 *
 * @example
 * ```typescript
 * const app = new Hono()
 * app.route("/queue", createQueueMiddleware({
 *   queues: [queue],
 *   auth: { tokens: ["secret"] },
 * }))
 * ```
 */
export function createQueueMiddleware(config: ServerConfig): Hono {
  const app = new Hono()
  const pubsub = new PubSub()

  // ─── Event Bridge ────────────────────────────────────────────────────────
  //
  // Lifecycle Event Matrix (In-Process Scope):
  //
  // | Source | Event          | → PubSub Topic       | Triggers stats:updated |
  // |--------|----------------|----------------------|------------------------|
  // | Queue  | job:added      | job:statusChanged    | yes                    |
  // | Queue  | job:cancelled  | job:statusChanged    | yes                    |
  // | Worker | job:processing | job:statusChanged    | no                     |
  // | Worker | job:completed  | job:statusChanged    | yes                    |
  // | Worker | job:failed     | job:statusChanged    | yes                    |
  // | Worker | job:retried    | job:statusChanged    | yes                    |
  // | Worker | job:dead       | job:statusChanged    | yes                    |
  //
  // Explicitly excluded:
  // - job:progress — High-frequency event, not a status transition.
  //   Progress is available via the `progress` field in the envelope when relevant.
  //
  // Scope: In-process only. Events are delivered to active subscription
  // consumers connected to this server instance. No cross-process delivery.

  wireEventBridge(config, pubsub)

  // Apply auth middleware to API routes
  const authMiddleware = createAuthMiddleware(config.auth ?? false)
  app.use("/graphql", authMiddleware)
  app.use("/health", authMiddleware)

  // Set up GraphQL Yoga
  const yoga = createYoga<SchemaContext>({
    context: () => ({
      queues: config.queues,
      pubsub,
    }),
    graphqlEndpoint: "/graphql",
    schema,
  })

  // Mount GraphQL endpoint
  app.on(["GET", "POST"], "/graphql", async (c) => {
    const response = await yoga.handle(c.req.raw, {
      pubsub,
      queues: config.queues,
    })
    return response
  })

  // Health check
  app.get("/health", (c) => c.json({ status: "ok" }))

  return app
}

/**
 * Create a lifecycle event envelope from a Job and context.
 */
function createLifecycleEvent(
  job: Job,
  queueName: string,
  previousStatus?: JobStatus
): JobLifecycleEvent {
  return {
    currentStatus: job.status,
    jobId: job.id,
    jobName: job.name,
    previousStatus,
    progress: job.progress > 0 ? job.progress : undefined,
    queueName,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Wire the event bridge between Queue/Worker lifecycle events and PubSub.
 *
 * All event forwarding is centralized here. No publish calls exist
 * in resolvers or adapters. Publishes JobLifecycleEvent envelopes.
 *
 * @param config - Server configuration with queues and optional workers
 * @param pubsub - PubSub instance for subscription delivery
 */
function wireEventBridge(config: ServerConfig, pubsub: PubSub): void {
  const refreshStats = async (): Promise<void> => {
    for (const queue of config.queues) {
      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- sequential per queue
      const stats = await queue.adapter.getQueueStats()
      pubsub.publish("stats:updated", stats)
    }
  }

  // Queue events (producer-side)
  for (const queue of config.queues) {
    queue.on("job:added", (job) => {
      pubsub.publish("job:statusChanged", createLifecycleEvent(job, queue.name))
      void refreshStats()
    })
    queue.on("job:cancelled", (job) => {
      pubsub.publish(
        "job:statusChanged",
        createLifecycleEvent(job, queue.name, "pending")
      )
      void refreshStats()
    })
  }

  // Worker events (consumer-side processing lifecycle)
  for (const worker of config.workers ?? []) {
    const queueName = worker.name

    worker.on("job:processing", (job) => {
      pubsub.publish(
        "job:statusChanged",
        createLifecycleEvent(job, queueName, "pending")
      )
    })
    worker.on("job:completed", (job) => {
      pubsub.publish(
        "job:statusChanged",
        createLifecycleEvent(job, queueName, "processing")
      )
      void refreshStats()
    })
    worker.on("job:failed", (job) => {
      pubsub.publish(
        "job:statusChanged",
        createLifecycleEvent(job, queueName, "processing")
      )
      void refreshStats()
    })
    worker.on("job:retried", (job) => {
      pubsub.publish(
        "job:statusChanged",
        createLifecycleEvent(job, queueName, "failed")
      )
      void refreshStats()
    })
    worker.on("job:dead", (job) => {
      pubsub.publish(
        "job:statusChanged",
        createLifecycleEvent(job, queueName, "failed")
      )
      void refreshStats()
    })
  }
}

/**
 * Create and start a standalone queue server.
 *
 * @param config - Server configuration
 * @returns Object with start/stop methods
 *
 * @example
 * ```typescript
 * const server = createQueueServer({
 *   queues: [queue],
 *   port: 3000,
 *   auth: { tokens: [process.env.QUEUE_TOKEN] },
 * })
 *
 * await server.start()
 * ```
 */
export function createQueueServer(config: ServerConfig) {
  const port = config.port ?? 3000
  const app = createQueueMiddleware(config)

  let server: ReturnType<typeof serve> | undefined

  return {
    /** The Hono app instance */
    app,

    /** Start the server */
    async start(): Promise<void> {
      await Promise.all(config.queues.map((q) => q.connect()))

      server = serve({ fetch: app.fetch, port })
      const queueNames = config.queues.map((q) => q.name).join(", ")
      // eslint-disable-next-line no-console
      console.log(`vorsteh-queue server running on http://localhost:${port}`)
      // eslint-disable-next-line no-console
      console.log(`  GraphQL:  http://localhost:${port}/graphql`)
      // eslint-disable-next-line no-console
      console.log(`  Queues:   ${queueNames}`)
    },

    /** Stop the server */
    async stop(): Promise<void> {
      server?.close()
      await Promise.all(config.queues.map((q) => q.disconnect()))
    },
  }
}
