import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db, pool } from "./database"

// Job payload types
interface EmailJob {
  to: string
  subject: string
  body?: string
}

interface DataProcessingJob {
  data: unknown[]
  batchSize?: number
}

// Job result types
interface EmailResult {
  sent: boolean
  messageId: string
}

interface DataProcessingResult {
  processed: number
  results: unknown[]
}

// Queue setup
const adapter = new PostgresQueueAdapter(db, "example-queue")
const queue = new Queue(adapter, { 
  name: "example-queue",
  removeOnComplete: 10,
  removeOnFail: 5
})

// Job handlers with proper types
queue.register<EmailJob, EmailResult>("send-email", async (job) => {
  console.log(`📧 Sending email to ${job.payload.to}: ${job.payload.subject}`)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return { 
    sent: true, 
    messageId: `msg_${Date.now()}` 
  }
})

queue.register<DataProcessingJob, DataProcessingResult>("process-data", async (job) => {
  const { data, batchSize = 10 } = job.payload
  console.log(`📊 Processing ${data.length} items in batches of ${batchSize}`)
  
  const results = []
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize)
    await new Promise((resolve) => setTimeout(resolve, 500))
    results.push(...batch)
    
    // Update progress
    const progress = Math.round(((i + batch.length) / data.length) * 100)
    await job.updateProgress(progress)
  }
  
  return { processed: results.length, results }
})

async function main() {
  console.log("🚀 Starting Drizzle PostgreSQL Queue Example")
  
  // Add event listeners
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

  // Add some jobs
  await queue.add<EmailJob>("send-email", { 
    to: "user@example.com", 
    subject: "Welcome!",
    body: "Thanks for joining us!"
  })
  
  await queue.add<DataProcessingJob>("process-data", { 
    data: Array.from({ length: 20 }, (_, i) => `item-${i + 1}`),
    batchSize: 5
  }, { priority: 1 })
  
  await queue.add<EmailJob>("send-email", { 
    to: "admin@example.com", 
    subject: "System Report",
    body: "Daily system status"
  }, { delay: 5000 })

  // Start processing
  queue.start()
  console.log("🔄 Queue processing started. Press Ctrl+C to stop.")

  // Show stats periodically
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("📊 Queue Stats:", stats)
  }, 10000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...")
    clearInterval(statsInterval)
    await queue.stop()
    await pool.end()
    console.log("✅ Shutdown complete")
    process.exit(0)
  })
}

main().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})
