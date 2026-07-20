// Import pushSchema from drizzle-kit/api-postgres (ESM-compatible require)
import { createRequire } from "node:module"

import { createQueueServer } from "@vorsteh-queue/server"

import { client, db } from "./database"
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

/**
 * Advanced TUI Dashboard Example
 *
 * Starts a GraphQL server with multiple queues backed by PGlite (embedded
 * PostgreSQL), diverse job types, and active workers for testing the TUI
 * dashboard locally.
 *
 * Usage:
 *   pnpm dev              — Start server + workers + seed data
 *   pnpm dashboard        — Open the TUI dashboard (in another terminal)
 */

const PORT = 4000
const TOKEN = "dev-token"

async function main() {
  // Initialize PGlite schema (in-memory, starts empty each run)
  console.log("Initializing PGlite database schema...")
  const { apply } = await pushSchema(schema, db as never)
  await apply()
  console.log("Database schema ready\n")

  // Connect all queues
  await emailQueue.connect()
  await dataQueue.connect()
  await notificationQueue.connect()
  await deploymentQueue.connect()

  // Seed diverse job data
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

  // Start GraphQL server
  const server = createQueueServer({
    auth: { tokens: [TOKEN] },
    port: PORT,
    queues: [emailQueue, dataQueue, notificationQueue, deploymentQueue],
    workers: [emailWorker, dataWorker, notificationWorker, deployWorker],
  })

  await server.start()

  console.log("─".repeat(60))
  console.log("  Advanced TUI Dashboard Example (PGlite + Drizzle)")
  console.log("─".repeat(60))
  console.log(`  GraphQL:  http://localhost:${PORT}/graphql`)
  console.log(`  Token:    ${TOKEN}`)
  console.log("")
  console.log("  Connect the TUI dashboard:")
  console.log("    pnpm dashboard              (email queue)")
  console.log("    pnpm dashboard:data         (data-processing queue)")
  console.log("    pnpm dashboard:notifications")
  console.log("")
  console.log("  Or manually:")
  console.log(
    `    vorsteh-queue dashboard --url http://localhost:${PORT}/graphql --token ${TOKEN} --queue <name>`
  )
  console.log("")
  console.log("  Queues:")
  console.log("    • email          — welcome emails, invoices, digests (cron)")
  console.log(
    "    • data-processing — reports, CSV imports, cleanup (cron, deps)"
  )
  console.log("    • notifications  — push, slack, webhooks (burst, cron)")
  console.log("    • deployments    — multi-step flows (steps, sleep, waitFor)")
  console.log("")
  console.log("  Features demonstrated:")
  console.log("    • PGlite embedded PostgreSQL (zero-config, in-memory)")
  console.log("    • Drizzle ORM adapter")
  console.log("    • Recurring jobs (cron expressions)")
  console.log("    • Delayed jobs")
  console.log("    • Job dependencies (pipeline)")
  console.log("    • Flow trees (onboarding pipeline, deploy pipeline)")
  console.log("    • Multi-step workflows (step.run, step.sleep, step.waitFor)")
  console.log("    • Job groups (FIFO per customer)")
  console.log("    • Unique/deduplicated jobs")
  console.log("    • Progress updates")
  console.log("    • Simulated failures & retries")
  console.log("    • Multiple priorities")
  console.log("─".repeat(60))
  console.log("  Press Ctrl+C to stop")
  console.log("─".repeat(60))

  // Continuously add new jobs to keep the dashboard interesting
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
    await server.stop()
    await client.close()
    console.log("Shutdown complete")
    process.exit(0)
  })
}

main().catch(console.error)
