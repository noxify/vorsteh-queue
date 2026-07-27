/**
 * TUI Direct Mode — Production Setup (with PGlite Socket Server)
 *
 * Starts PGlite with a socket server so the TUI dashboard can connect
 * as a separate process via queue.config.ts.
 *
 * Terminal 1: Start workers + socket server
 *   pnpm dev:prod
 *
 * Terminal 2: Start dashboard
 *   pnpm dashboard
 */

import { createRequire } from "node:module"

import { client, db, startSocketServer } from "./database"
import {
  dataQueue,
  deploymentQueue,
  emailQueue,
  notificationQueue,
} from "./queues"
import * as schema from "./schema"
import { seedJobs } from "./seed"
import {
  dataWorker,
  deployWorker,
  emailWorker,
  notificationWorker,
} from "./workers"

const esmRequire = createRequire(import.meta.url)
const { pushSchema } = esmRequire("drizzle-kit/api-postgres") as {
  pushSchema: (
    schema: Record<string, unknown>,
    db: unknown
  ) => Promise<{ apply: () => Promise<void> }>
}

async function main() {
  // Start socket server for dashboard process to connect
  const socketServer = await startSocketServer()

  // Initialize schema
  console.log("Initializing PGlite database schema...")
  const { apply } = await pushSchema(schema, db as never)
  await apply()
  console.log("Database schema ready\n")

  // Connect all queues
  await emailQueue.connect()
  await dataQueue.connect()
  await notificationQueue.connect()
  await deploymentQueue.connect()

  // Seed initial jobs
  console.log("Seeding jobs...")
  await seedJobs()
  console.log("Jobs seeded\n")

  // Start workers
  emailWorker.start()
  dataWorker.start()
  notificationWorker.start()
  deployWorker.start()

  const port = process.env.PGLITE_PORT ?? "5488"
  console.log("Workers started")
  console.log(`\nDashboard can now connect via queue.config.ts (port ${port})`)
  console.log("Run 'pnpm dashboard' in another terminal\n")

  // Continuously add jobs
  const continuousInterval = setInterval(async () => {
    try {
      const jobType = Math.random()
      if (jobType < 0.3) {
        await emailQueue.add("send-welcome", {
          to: `user-${Date.now()}@example.com`,
        })
      } else if (jobType < 0.6) {
        await notificationQueue.add("push-notification", {
          message: "Activity update",
          platform: ["ios", "android", "web"][Math.floor(Math.random() * 3)],
          userId: `user-${Math.floor(Math.random() * 100)}`,
        })
      } else {
        await notificationQueue.add("slack-alert", {
          channel: "#monitoring",
          message: `Metric spike at ${new Date().toISOString()}`,
        })
      }
    } catch {
      // Ignore
    }
  }, 3000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...")
    clearInterval(continuousInterval)
    await emailWorker.stop()
    await dataWorker.stop()
    await notificationWorker.stop()
    await deployWorker.stop()
    await socketServer.stop()
    await client.close()
    console.log("Shutdown complete")
    process.exit(0)
  })
}

main().catch(console.error)
