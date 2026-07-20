/**
 * TUI Direct Mode — Production Setup
 *
 * With a real PostgreSQL database, the dashboard and workers run as
 * separate processes since they can both connect to the same database.
 *
 * Terminal 1: Start workers
 *   tsx src/index-prod.ts
 *
 * Terminal 2: Start dashboard
 *   vorsteh-queue dashboard
 *
 * The dashboard reads queue.config.ts and connects directly to the
 * adapter. No GraphQL server, no ink/react dependencies needed.
 */

import {
  dataQueue,
  deploymentQueue,
  emailQueue,
  notificationQueue,
} from "./queues"
import { seedJobs } from "./seed"
import {
  dataWorker,
  deployWorker,
  emailWorker,
  notificationWorker,
} from "./workers"

async function main() {
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
  console.log("Workers started")
  console.log("Run 'vorsteh-queue dashboard' in another terminal\n")

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...")
    await emailWorker.stop()
    await dataWorker.stop()
    await notificationWorker.stop()
    await deployWorker.stop()
    process.exit(0)
  })
}

main().catch(console.error)
