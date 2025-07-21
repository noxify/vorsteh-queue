import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db, client } from "./database"
import * as schema from "./schema"

// Import pushSchema from drizzle-kit/api
// Source: https://github.com/drizzle-team/drizzle-orm/issues/4205
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
const { pushSchema } = require("drizzle-kit/api") as typeof import("drizzle-kit/api")

// Job payload and result types
interface ProcessDataPayload {
  items: string[]
  batchSize: number
}

interface ProcessDataResult {
  processed: number
  failed: number
  duration: number
  errors: string[]
}

// Queue setup
const queue = new Queue(new PostgresQueueAdapter(db), { 
  name: "result-demo",
  removeOnComplete: 10,
  removeOnFail: 5
})

// Job handler that returns a detailed result
queue.register<ProcessDataPayload, ProcessDataResult>("process-data", async (job) => {
  const startTime = Date.now()
  const { items, batchSize } = job.payload
  const errors: string[] = []
  let processed = 0
  let failed = 0

  console.log(`📊 Processing ${items.length} items in batches of ${batchSize}`)

  // Process items in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    for (const item of batch) {
      try {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 10))
        
        // Simulate occasional failures
        if (Math.random() < 0.1) {
          throw new Error(`Failed to process item: ${item}`)
        }
        
        processed++
      } catch (error) {
        failed++
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    // Update progress
    const progress = Math.round(((i + batch.length) / items.length) * 100)
    await job.updateProgress(progress)
  }

  const duration = Date.now() - startTime

  // Return result - this will be stored in the job record
  return {
    processed,
    failed,
    duration,
    errors
  }
})

async function main() {
  console.log("🚀 Starting Result Storage Example (Job Results & Progress Tracking)")
  
  // Initialize database schema (PGlite starts empty)
  console.log("📋 Initializing database schema...")
  const { apply } = await pushSchema(schema, db as never)
  await apply()
  console.log("✅ Database schema initialized")

  // Add event listeners
  queue.on("job:added", (job) => {
    console.log(`✅ Job added: ${job.name} (${job.id})`)
  })
  
  queue.on("job:processing", (job) => {
    console.log(`⚡ Processing: ${job.name} (${job.id})`)
  })
  
  queue.on("job:completed", (job) => {
    console.log(`🎉 Completed: ${job.name} (${job.id})`)
    console.log(`📊 Result:`, job.result)
  })
  
  queue.on("job:failed", (job) => {
    console.error(`❌ Failed: ${job.name} (${job.id}) - ${job.error}`)
  })
  
  queue.on("job:progress", (job) => {
    console.log(`📈 Progress: ${job.name} - ${job.progress}%`)
  })

  // Add jobs with different configurations
  await queue.add<ProcessDataPayload>("process-data", {
    items: Array.from({ length: 50 }, (_, i) => `item-${i + 1}`),
    batchSize: 10
  })

  await queue.add<ProcessDataPayload>("process-data", {
    items: Array.from({ length: 25 }, (_, i) => `priority-item-${i + 1}`),
    batchSize: 5
  }, { priority: 1 })

  // Start processing
  queue.start()
  console.log("🔄 Queue processing started. Press Ctrl+C to stop.")

  // Show stats periodically
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("📊 Queue Stats:", stats)
  }, 5000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...")
    clearInterval(statsInterval)
    await queue.stop()
    await client.close()
    console.log("✅ Shutdown complete")
    process.exit(0)
  })
}

main().catch(console.error)