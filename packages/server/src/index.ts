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
import { createYoga } from "graphql-yoga"
import { Hono } from "hono"

import { createAuthMiddleware } from "./api/auth"
import { PubSub } from "./api/pubsub"
import type { SchemaContext } from "./api/schema"
import { schema } from "./api/schema"
import type { ServerConfig } from "./config"

export type { AuthConfig, ServerConfig } from "./config"
export { defineConfig, loadConfig } from "./config"
export { createAuthMiddleware } from "./api/auth"
export { PubSub } from "./api/pubsub"
export type { PubSubEvents } from "./api/pubsub"

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
