import { Worker } from "@vorsteh-queue/core"

import { client } from "./database"
import { adapter, queue } from "./queues"

// Job payload types
interface ReportJobPayload {
  userId: string
  type: "daily" | "weekly" | "monthly"
  includeCharts?: boolean
}

interface CleanupJobPayload {
  olderThan: string
  fileTypes?: string[]
}

// Job result types
interface ReportJobResult {
  reportId: string
  status: "completed" | "failed"
  fileSize?: number
}

interface CleanupJobResult {
  deletedCount: number
  freedSpace: number
}

// Worker setup (consumer)
const worker = new Worker(adapter, {
  concurrency: 2,
  name: "advanced-queue",
  removeOnComplete: 20,
  removeOnFail: 10,
})

// Job handlers with proper types
worker.register<ReportJobPayload, ReportJobResult>(
  "generate-report",
  async (job) => {
    const { userId, type, includeCharts = false } = job.payload
    console.log(
      `Generating ${type} report for user ${userId}${includeCharts ? " with charts" : ""}`
    )

    // Simulate report generation with progress
    const steps = [
      "Collecting data",
      "Processing metrics",
      "Generating charts",
      "Finalizing report",
    ]
    for (let i = 0; i < steps.length; i++) {
      console.log(`   ${steps[i]}...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await job.updateProgress(Math.round(((i + 1) / steps.length) * 100))
    }

    return {
      fileSize: Math.floor(Math.random() * 1_000_000) + 100_000,
      reportId: `report_${Date.now()}`,
      status: "completed",
    }
  }
)

worker.register<CleanupJobPayload, CleanupJobResult>(
  "cleanup-files",
  async (job) => {
    const { olderThan, fileTypes = ["tmp", "log"] } = job.payload
    console.log(
      `Cleaning up ${fileTypes.join(", ")} files older than ${olderThan}`
    )

    await new Promise((resolve) => setTimeout(resolve, 1500))
    const deletedCount = Math.floor(Math.random() * 50) + 10
    const freedSpace = deletedCount * Math.floor(Math.random() * 1_000_000)

    return { deletedCount, freedSpace }
  }
)

// Queue events (producer-side)
queue.on("job:added", (job) => {
  console.log(`Job added: ${job.name} (${job.id})`)
})

// Worker events (consumer-side)
worker.on("job:processing", (job) => {
  console.log(`Processing: ${job.name} (${job.id})`)
})

worker.on("job:completed", (job) => {
  console.log(`Completed: ${job.name} (${job.id})`)
})

worker.on("job:failed", (job) => {
  console.error(`Failed: ${job.name} (${job.id}) - ${job.error}`)
})

worker.on("job:progress", (job) => {
  console.log(`Progress: ${job.name} - ${job.progress}%`)
})

worker.on("job:retried", (job) => {
  console.log(`Retrying: ${job.name} (attempt ${job.attempts})`)
})

async function main() {
  console.log("Starting Kysely Custom Schema/Table Queue Example")

  // Add jobs with different priorities and features
  await queue.add(
    "generate-report",
    {
      includeCharts: true,
      type: "monthly",
      userId: "user123",
    },
    { priority: 1 }
  )

  await queue.add(
    "cleanup-files",
    {
      fileTypes: ["tmp", "log", "cache"],
      olderThan: "30d",
    },
    { priority: 3 }
  )

  await queue.add(
    "generate-report",
    {
      type: "weekly",
      userId: "user456",
    },
    { delay: 5000, priority: 2 }
  )

  // Add recurring cleanup job
  await queue.add(
    "cleanup-files",
    { olderThan: "7d" },
    {
      repeat: { every: 30_000, limit: 3 }, // Every 30 seconds, 3 times
    }
  )

  // Add cron job
  await queue.add(
    "generate-report",
    { type: "daily", userId: "system" },
    {
      cron: "0 9 * * *", // Every day at 9 AM
    }
  )

  // Start processing
  worker.start()
  console.log("Advanced queue processing started. Press Ctrl+C to stop.")

  // Show detailed stats every 15 seconds
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("Detailed Queue Stats:", {
      ...stats,
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
    })
  }, 15_000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down advanced queue...")
    clearInterval(statsInterval)
    await worker.stop()
    await client.end()
    console.log("Advanced queue shutdown complete")
    process.exit(0)
  })
}

main().catch((error) => {
  console.error("Advanced queue error:", error)
  process.exit(1)
})
