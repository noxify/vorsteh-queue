/**
 * Queue worker process for the dashboard example.
 *
 * 1. Initializes PGlite (file-backed)
 * 2. Starts a PGlite socket server (so Next.js can connect via node-postgres)
 * 3. Pushes the schema
 * 4. Seeds jobs
 * 5. Starts workers + continuous job generation
 *
 * Usage:
 *   pnpm dev:queue    — Start this process first
 *   pnpm dev          — Then start Next.js in another terminal
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
  // Start PGlite socket server for Next.js to connect
  const socketServer = await startSocketServer()

  // Initialize schema
  console.log("Initializing PGlite database schema...")
  const { apply } = await pushSchema(schema, db as never)
  await apply()
  console.log("Database schema ready\n")

  // Connect queues
  await emailQueue.connect()
  await dataQueue.connect()
  await notificationQueue.connect()
  await deploymentQueue.connect()

  // Seed
  console.log("Seeding jobs...")
  await seedJobs()
  console.log("Jobs seeded successfully\n")

  // Start workers
  emailWorker.start()
  dataWorker.start()
  notificationWorker.start()
  deployWorker.start()
  console.log(
    "Workers started (email: 2, data: 1, notifications: 3, deploy: 1)\n"
  )

  const port = process.env.PGLITE_PORT ?? "5488"

  console.log("─".repeat(60))
  console.log("  Dashboard Queue Workers")
  console.log("─".repeat(60))
  console.log(`  PGlite:   127.0.0.1:${port} (socket server)`)
  console.log(`  Data dir: .vorsteh-queue/data/`)
  console.log("")
  console.log("  Connect Next.js dashboard in another terminal:")
  console.log(
    `    DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${port}/postgres pnpm dev`
  )
  console.log("  Or just:")
  console.log("    pnpm dev")
  console.log("")
  console.log("  Press Ctrl+C to stop workers")
  console.log("─".repeat(60))

  // Continuously add new jobs
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
      // Ignore errors from continuous seeding
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
