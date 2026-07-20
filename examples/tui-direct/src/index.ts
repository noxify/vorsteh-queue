// Import pushSchema from drizzle-kit/api-postgres (ESM-compatible require)
import { createRequire } from "node:module"

import { App, createDirectMultiQueueTransport } from "@vorsteh-queue/cli"

import { client, db } from "./database"
import {
  createAdapter,
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
 * TUI Direct Mode Example
 *
 * Runs workers, seeds data, and launches the TUI dashboard in a single
 * process using PGlite (embedded PostgreSQL). No server needed.
 *
 * Usage:
 *   pnpm dev — Start workers + seed + dashboard (all-in-one)
 */

async function main() {
  // Initialize PGlite schema
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
  console.log("Workers started\n")

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

  // Create direct transport (no GraphQL, same process)
  const queueNames = [
    "email",
    "data-processing",
    "notifications",
    "deployments",
  ]
  const transport = createDirectMultiQueueTransport(
    createAdapter(),
    queueNames,
    "email"
  )
  await transport.connect()

  // Launch the TUI dashboard
  const { render } = await import("ink")
  const { createElement } = await import("react")

  // Enter alternate screen buffer
  process.stdout.write("\u001B[?1049h")
  process.stdout.write("\u001B[H")

  const { waitUntilExit } = render(
    createElement(App, {
      refreshInterval: 1000,
      showSidebar: true,
      transport,
    })
  )

  await waitUntilExit()

  // Cleanup
  process.stdout.write("\u001B[?1049l")
  clearInterval(continuousInterval)
  await emailWorker.stop()
  await dataWorker.stop()
  await notificationWorker.stop()
  await deployWorker.stop()
  await client.close()
}

main().catch(console.error)
