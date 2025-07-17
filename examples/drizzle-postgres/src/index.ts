import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { DrizzleQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import * as schema from "./schema"

// Database setup
const client = postgres(process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/queue_db")
const db = drizzle(client, { schema })

// Queue setup
const adapter = new DrizzleQueueAdapter(db, "example-queue")
const queue = new Queue(adapter, { name: "example-queue" })

// Job handlers
queue.register("generate-report", async (payload: { userId: string; type: string }) => {
  console.log(`Generating ${payload.type} report for user ${payload.userId}`)
  await new Promise(resolve => setTimeout(resolve, 3000)) // Simulate work
  return { reportId: `report_${Date.now()}`, status: "completed" }
})

queue.register("cleanup-files", async (payload: { olderThan: string }) => {
  console.log(`Cleaning up files older than ${payload.olderThan}`)
  await new Promise(resolve => setTimeout(resolve, 1500)) // Simulate work
  return { deletedCount: Math.floor(Math.random() * 10) }
})

// Event listeners
queue.on("job:completed", (job) => {
  console.log(`✅ Job ${job.name} completed successfully`)
})

queue.on("job:failed", (job) => {
  console.log(`❌ Job ${job.name} failed: ${job.error}`)
})

async function main() {
  await queue.connect()
  
  // Add jobs with different priorities
  await queue.add("generate-report", { userId: "user123", type: "monthly" }, { priority: 1 })
  await queue.add("cleanup-files", { olderThan: "30d" }, { priority: 3 })
  await queue.add("generate-report", { userId: "user456", type: "weekly" }, { priority: 2 })

  // Add recurring job
  await queue.add("cleanup-files", { olderThan: "7d" }, { 
    repeat: { every: 60000, limit: 5 } // Every minute, 5 times
  })

  // Start processing
  queue.start()
  
  console.log("Queue started. Press Ctrl+C to stop.")
  
  // Show stats every 10 seconds
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("📊 Queue stats:", stats)
  }, 10000)
  
  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down...")
    clearInterval(statsInterval)
    await queue.stop()
    await queue.disconnect()
    await client.end()
    process.exit(0)
  })
}

main().catch(console.error)