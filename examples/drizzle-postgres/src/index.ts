import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db, client } from "./database"

// Job payload types
interface ReportJob {
  userId: string
  type: 'daily' | 'weekly' | 'monthly'
  includeCharts?: boolean
}

interface CleanupJob {
  olderThan: string
  fileTypes?: string[]
}

// Job result types
interface ReportResult {
  reportId: string
  status: 'completed' | 'failed'
  fileSize?: number
}

interface CleanupResult {
  deletedCount: number
  freedSpace: number
}

// Queue setup
const queue = new Queue(new PostgresQueueAdapter(db), { 
  name: "advanced-queue",
  removeOnComplete: 20,
  removeOnFail: 10
})

// Job handlers with proper types
queue.register<ReportJob, ReportResult>("generate-report", async (job) => {
  const { userId, type, includeCharts = false } = job.payload
  console.log(`📈 Generating ${type} report for user ${userId}${includeCharts ? ' with charts' : ''}`)
  
  // Simulate report generation with progress
  const steps = ['Collecting data', 'Processing metrics', 'Generating charts', 'Finalizing report']
  for (let i = 0; i < steps.length; i++) {
    console.log(`   ${steps[i]}...`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await job.updateProgress(Math.round(((i + 1) / steps.length) * 100))
  }
  
  return { 
    reportId: `report_${Date.now()}`, 
    status: "completed",
    fileSize: Math.floor(Math.random() * 1000000) + 100000
  }
})

queue.register<CleanupJob, CleanupResult>("cleanup-files", async (job) => {
  const { olderThan, fileTypes = ['tmp', 'log'] } = job.payload
  console.log(`🧽 Cleaning up ${fileTypes.join(', ')} files older than ${olderThan}`)
  
  await new Promise((resolve) => setTimeout(resolve, 1500))
  const deletedCount = Math.floor(Math.random() * 50) + 10
  const freedSpace = deletedCount * Math.floor(Math.random() * 1000000)
  
  return { deletedCount, freedSpace }
})

// Event listeners
queue.on("job:added", (job) => {
  console.log(`✅ Job added: ${job.name} (${job.id})`)
})

queue.on("job:processing", (job) => {
  console.log(`⚡ Processing: ${job.name} (${job.id})`)
})

queue.on("job:completed", (job) => {
  console.log(`🎉 Completed: ${job.name} (${job.id})`)
})

queue.on("job:failed", (job) => {
  console.error(`❌ Failed: ${job.name} (${job.id}) - ${job.error}`)
})

queue.on("job:progress", (job) => {
  console.log(`📈 Progress: ${job.name} - ${job.progress}%`)
})

queue.on("job:retried", (job) => {
  console.log(`🔄 Retrying: ${job.name} (attempt ${job.attempts})`)
})

async function main() {
  console.log("🚀 Starting Advanced Drizzle PostgreSQL Queue Example")

  // Add jobs with different priorities and features
  await queue.add<ReportJob>("generate-report", { 
    userId: "user123", 
    type: "monthly",
    includeCharts: true
  }, { priority: 1 })
  
  await queue.add<CleanupJob>("cleanup-files", { 
    olderThan: "30d",
    fileTypes: ['tmp', 'log', 'cache']
  }, { priority: 3 })
  
  await queue.add<ReportJob>("generate-report", { 
    userId: "user456", 
    type: "weekly"
  }, { priority: 2, delay: 5000 })

  // Add recurring cleanup job
  await queue.add<CleanupJob>(
    "cleanup-files",
    { olderThan: "7d" },
    {
      repeat: { every: 30000, limit: 3 }, // Every 30 seconds, 3 times
    },
  )

  // Add cron job
  await queue.add<ReportJob>(
    "generate-report",
    { userId: "system", type: "daily" },
    {
      cron: "0 9 * * *", // Every day at 9 AM
    }
  )

  // Start processing
  queue.start()
  console.log("🔄 Advanced queue processing started. Press Ctrl+C to stop.")

  // Show detailed stats every 15 seconds
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("📊 Detailed Queue Stats:", {
      ...stats,
      total: Object.values(stats).reduce((sum, count) => sum + count, 0)
    })
  }, 15000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down advanced queue...")
    clearInterval(statsInterval)
    await queue.stop()
    await client.end()
    console.log("✅ Advanced queue shutdown complete")
    process.exit(0)
  })
}

main().catch((error) => {
  console.error("❌ Advanced queue error:", error)
  process.exit(1)
})
