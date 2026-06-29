import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-kysely"
import { Queue, Worker } from "@vorsteh-queue/core"

import { client, db } from "./database"

// Setup
const adapter = new PostgresQueueAdapter(db)
const queue = new Queue(adapter, { name: "advanced-queue" })
const worker = new Worker(adapter, {
  name: "advanced-queue",
  concurrency: 3,
  removeOnComplete: 20,
  removeOnFail: 10,
})

interface ReportPayload {
  userId: string
  type: "daily" | "weekly" | "monthly"
}

worker.register<ReportPayload, { reportId: string }>(
  "generate-report",
  async (job) => {
    const { userId, type } = job.payload
    console.log(`Generating ${type} report for user ${userId}`)

    const steps = ["Collecting data", "Processing", "Generating", "Done"]
    for (let i = 0; i < steps.length; i += 1) {
      console.log(`  ${steps[i]}...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await job.updateProgress(Math.round(((i + 1) / steps.length) * 100))
    }

    return { reportId: `report_${Date.now()}` }
  }
)

// Events
queue.on("job:added", (job) => console.log(`Added: ${job.name} (${job.id})`))
worker.on("job:completed", (job) =>
  console.log(`Completed: ${job.name} (${job.id})`)
)
worker.on("job:failed", (job) =>
  console.error(`Failed: ${job.name} - ${job.error?.message}`)
)

async function main() {
  console.log("Starting Kysely PostgreSQL Queue Example")
  await queue.connect()

  await queue.add(
    "generate-report",
    { userId: "user123", type: "monthly" },
    { priority: 1 }
  )
  await queue.add(
    "generate-report",
    { userId: "user456", type: "weekly" },
    { delay: 5000 }
  )
  await queue.add(
    "generate-report",
    { userId: "system", type: "daily" },
    { cron: "0 9 * * *" }
  )

  worker.start()
  console.log("Processing started. Press Ctrl+C to stop.")

  process.on("SIGINT", async () => {
    await worker.stop()
    await queue.disconnect()
    await client.end()
    process.exit(0)
  })
}

main().catch(console.error)
