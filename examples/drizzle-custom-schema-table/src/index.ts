import { Worker } from "@vorsteh-queue/core"

import { client } from "./database"
import { adapter, queue } from "./queues"

interface ReportJob {
  userId: string
  type: "daily" | "weekly" | "monthly"
}

const worker = new Worker(adapter, {
  concurrency: 2,
  name: "advanced-queue",
  removeOnComplete: 20,
  removeOnFail: 10,
})

worker.register<ReportJob, { reportId: string }>(
  "generate-report",
  async (job) => {
    const { userId, type } = job.payload
    console.log(`Generating ${type} report for user ${userId}`)

    const steps = ["Collecting", "Processing", "Generating", "Finalizing"]
    for (let i = 0; i < steps.length; i += 1) {
      console.log(`  ${steps[i]}...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await job.updateProgress(Math.round(((i + 1) / steps.length) * 100))
    }

    return { reportId: `report_${Date.now()}` }
  }
)

queue.on("job:added", (job) => console.log(`Added: ${job.name} (${job.id})`))
worker.on("job:completed", (job) => console.log(`Completed: ${job.name}`))

async function main() {
  console.log("Starting Custom Schema/Table Example")
  await queue.connect()

  await queue.add(
    "generate-report",
    { type: "monthly", userId: "user123" },
    { priority: 1 }
  )
  await queue.add(
    "generate-report",
    { type: "weekly", userId: "user456" },
    { delay: 5000 }
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
