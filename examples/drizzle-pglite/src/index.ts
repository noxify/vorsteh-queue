import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db, client } from "./database"

// Job payload types
interface EmailJob {
  to: string
  subject: string
  body: string
}

interface DataProcessingJob {
  items: string[]
  batchSize: number
}

async function main() {
  console.log("🚀 Starting PGlite Queue Example")

  // Create tables (PGlite starts empty)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS queue_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      queue_name VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      payload JSONB NOT NULL,
      status VARCHAR(50) NOT NULL,
      priority INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0 NOT NULL,
      max_attempts INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      process_at TIMESTAMP WITH TIME ZONE NOT NULL,
      processed_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      failed_at TIMESTAMP WITH TIME ZONE,
      error JSONB,
      progress INTEGER DEFAULT 0,
      cron VARCHAR(255),
      repeat_every INTEGER,
      repeat_limit INTEGER,
      repeat_count INTEGER DEFAULT 0
    );
    
    CREATE INDEX IF NOT EXISTS idx_queue_jobs_status_priority 
    ON queue_jobs (queue_name, status, priority, created_at);
    
    CREATE INDEX IF NOT EXISTS idx_queue_jobs_process_at 
    ON queue_jobs (process_at);
  `)

  // Create queue adapter and queue
  const adapter = new PostgresQueueAdapter(db, "example-queue")
  const queue = new Queue(adapter, { 
    name: "example-queue",
    removeOnComplete: 10, // Keep last 10 completed jobs
    removeOnFail: 5,      // Keep last 5 failed jobs
  })

  // Register job handlers
  queue.register<EmailJob>("send-email", async (job) => {
    console.log(`📧 Sending email to ${job.payload.to}`)
    console.log(`   Subject: ${job.payload.subject}`)
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return { sent: true, timestamp: new Date().toISOString() }
  })

  queue.register<DataProcessingJob>("process-data", async (job) => {
    console.log(`📊 Processing ${job.payload.items.length} items`)
    
    const { items, batchSize } = job.payload
    const results = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      console.log(`   Processing batch: ${batch.join(", ")}`)
      
      // Update progress
      const progress = Math.round(((i + batch.length) / items.length) * 100)
      await job.updateProgress(progress)
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 500))
      results.push(...batch.map(item => `processed-${item}`))
    }
    
    return { results, totalProcessed: results.length }
  })

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
  console.log("\n📝 Adding jobs to queue...")

  await queue.add<EmailJob>("send-email", {
    to: "user@example.com",
    subject: "Welcome to Vorsteh Queue!",
    body: "Thanks for trying our queue system."
  })

  await queue.add<EmailJob>("send-email", {
    to: "admin@example.com", 
    subject: "System Report",
    body: "Daily system status report."
  }, {
    priority: 1, // Higher priority
    delay: 2000  // Delay 2 seconds
  })

  await queue.add<DataProcessingJob>("process-data", {
    items: ["item1", "item2", "item3", "item4", "item5"],
    batchSize: 2
  })

  // Add a recurring job
  await queue.add<EmailJob>("send-email", {
    to: "newsletter@example.com",
    subject: "Weekly Newsletter",
    body: "Your weekly update."
  }, {
    repeat: { every: 10000, limit: 3 } // Every 10 seconds, 3 times
  })

  // Start processing
  console.log("\n🔄 Starting queue processing...")
  queue.start()

  // Show queue stats periodically
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("\n📊 Queue Stats:", stats)
  }, 5000)

  // Graceful shutdown after 30 seconds
  setTimeout(async () => {
    console.log("\n🛑 Shutting down...")
    clearInterval(statsInterval)
    
    await queue.stop()
    await client.close()
    
    console.log("✅ Shutdown complete")
    process.exit(0)
  }, 30000)
}

main().catch(console.error)