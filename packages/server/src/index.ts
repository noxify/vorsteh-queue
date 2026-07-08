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
 * const server = createQueueServer({
 *   adapter: myAdapter,
 *   queueName: "my-queue",
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
 *   adapter: myAdapter,
 *   queueName: "my-queue",
 * }))
 * ```
 */

import path from "node:path"

import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
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

  // Dashboard config endpoint (unauthenticated — consumed by the SPA)
  app.get("/api/config", (c) =>
    c.json({
      graphqlEndpoint: config.graphqlEndpoint ?? "/graphql",
      queueName: config.queueName,
      authEnabled: config.auth !== false,
    })
  )

  // Serve dashboard UI (static assets)
  if (config.dashboard !== false) {
    // Resolve the UI directory relative to this file's location.
    // In dev (src/index.ts): ../dist/ui — In prod (dist/index.mjs): ./ui
    const currentDir = import.meta.dirname
    const uiRoot = currentDir.endsWith("src")
      ? path.resolve(currentDir, "../dist/ui")
      : path.resolve(currentDir, "ui")

    app.use("/*", serveStatic({ root: uiRoot }))
    // SPA fallback — serve index.html for unmatched routes
    app.get("/*", serveStatic({ root: uiRoot, path: "index.html" }))
  }

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
      await config.adapter.connect()
      config.adapter.setQueueName(config.queueName)

      server = serve({ fetch: app.fetch, port })
      const dashboardEnabled = config.dashboard !== false
      // eslint-disable-next-line no-console
      console.log(`vorsteh-queue server running on http://localhost:${port}`)
      // eslint-disable-next-line no-console
      console.log(`  GraphQL:  http://localhost:${port}/graphql`)
      if (dashboardEnabled) {
        // eslint-disable-next-line no-console
        console.log(`  Dashboard: http://localhost:${port}/`)
      }
    },

    /** Stop the server */
    async stop(): Promise<void> {
      server?.close()
      await config.adapter.disconnect()
    },
  }
}
