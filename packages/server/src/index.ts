/**
 * vorsteh-queue/server
 *
 * GraphQL server and optional web dashboard for monitoring and managing
 * vorsteh-queue jobs. Can run standalone or as Hono middleware.
 *
 * @example
 * ```typescript
 * import { createQueueServer } from "@vorsteh-queue/server"
 *
 * const app = createQueueServer({
 *   adapter: myAdapter,
 *   queueName: "my-queue",
 *   auth: { type: "token", token: process.env.QUEUE_TOKEN },
 * })
 *
 * await app.start()
 * ```
 *
 * @example
 * ```typescript
 * import { Hono } from "hono"
 * import { createQueueMiddleware } from "@vorsteh-queue/server"
 *
 * const app = new Hono()
 * app.route("/queue", createQueueMiddleware({
 *   adapter: myAdapter,
 *   queueName: "my-queue",
 * }))
 * ```
 */

import { serve } from "@hono/node-server"
import { createYoga } from "graphql-yoga"
import { Hono } from "hono"

import { createAuthMiddleware } from "./auth/middleware"
import type { ServerConfig } from "./config"
import type { SchemaContext } from "./graphql/schema"
import { schema } from "./graphql/schema"
import { PubSub } from "./pubsub"

export type { AuthConfig, ServerConfig } from "./config"
export { defineConfig } from "./config"
export { createAuthMiddleware } from "./auth/middleware"
export { PubSub } from "./pubsub"
export type { PubSubEvents } from "./pubsub"

/**
 * Create a Hono app configured as a queue management middleware.
 * Can be mounted on an existing Hono app via `app.route()`.
 *
 * @param config - Server configuration
 * @returns Hono app instance with GraphQL and optional dashboard routes
 *
 * @example
 * ```typescript
 * const app = new Hono()
 * app.route("/queue", createQueueMiddleware({
 *   adapter: myAdapter,
 *   queueName: "my-queue",
 *   auth: { type: "token", token: "secret" },
 * }))
 * ```
 */
export function createQueueMiddleware(config: ServerConfig): Hono {
  const app = new Hono()
  const pubsub = new PubSub()

  // Apply auth middleware
  if (config.auth === undefined) {
    app.use("*", createAuthMiddleware(false))
  } else {
    app.use("*", createAuthMiddleware(config.auth))
  }

  // Set up GraphQL Yoga
  const yoga = createYoga<SchemaContext>({
    schema,
    graphqlEndpoint: "/graphql",
    context: () => ({
      adapter: config.adapter,
      queueName: config.queueName,
      pubsub,
    }),
  })

  // Mount GraphQL endpoint
  app.on(["GET", "POST"], "/graphql", async (c) => {
    const response = await yoga.handle(c.req.raw, {
      adapter: config.adapter,
      queueName: config.queueName,
      pubsub,
    })
    return response
  })

  // Health check
  app.get("/health", (c) =>
    c.json({ status: "ok", queueName: config.queueName })
  )

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
 *   adapter: myAdapter,
 *   queueName: "my-queue",
 *   port: 3000,
 *   auth: { type: "token", token: process.env.QUEUE_TOKEN },
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
      await config.adapter.connect()
      config.adapter.setQueueName(config.queueName)

      server = serve({ fetch: app.fetch, port })
      // eslint-disable-next-line no-console
      console.log(`vorsteh-queue server running on http://localhost:${port}`)
      // eslint-disable-next-line no-console
      console.log(`GraphQL endpoint: http://localhost:${port}/graphql`)
    },

    /** Stop the server */
    async stop(): Promise<void> {
      server?.close()
      await config.adapter.disconnect()
    },
  }
}
