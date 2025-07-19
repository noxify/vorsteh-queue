import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { client, db } from "./database"

// Queue setup
const adapter = new PostgresQueueAdapter(db, "event-queue")
const queue = new Queue(adapter, { name: "event-queue" })

// Job statistics tracking
const stats = {
  added: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  retried: 0,
}

// Register various job types to demonstrate different scenarios
queue.register("reliable-task", async (payload) => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return { success: true, data: payload }
})

queue.register("unreliable-task", async (payload) => {
  await new Promise((resolve) => setTimeout(resolve, 500))

  // 50% chance of failure to demonstrate retry logic
  if (Math.random() < 0.5) {
    throw new Error("Random failure occurred")
  }

  return { success: true, data: payload }
})

queue.register("slow-task", async (payload) => {
  await new Promise((resolve) => setTimeout(resolve, 3000))
  return { success: true, processed: payload }
})

// Comprehensive event monitoring
queue.on("job:added", (job) => {
  stats.added++
  console.log(`✅ [${new Date().toISOString()}] Job added: ${job.name} (ID: ${job.id})`)
  console.log(`   Priority: ${job.priority}, Status: ${job.status}`)
})

queue.on("job:processing", (job) => {
  stats.processing++
  console.log(`⚡ [${new Date().toISOString()}] Job started: ${job.name} (ID: ${job.id})`)
  console.log(`   Attempt: ${job.attempts + 1}/${job.maxAttempts}`)
})

queue.on("job:completed", (job) => {
  stats.completed++
  const duration =
    job.completedAt && job.processedAt ? job.completedAt.getTime() - job.processedAt.getTime() : 0

  console.log(`🎉 [${new Date().toISOString()}] Job completed: ${job.name} (ID: ${job.id})`)
  console.log(`   Duration: ${duration}ms`)
})

queue.on("job:failed", (job) => {
  stats.failed++
  console.log(`❌ [${new Date().toISOString()}] Job failed: ${job.name} (ID: ${job.id})`)
  console.log(`   Error: ${job.error}`)
  console.log(`   Attempts: ${job.attempts}/${job.maxAttempts}`)
})

queue.on("job:retried", (job) => {
  stats.retried++
  console.log(`🔄 [${new Date().toISOString()}] Job retrying: ${job.name} (ID: ${job.id})`)
  console.log(`   Attempt: ${job.attempts}/${job.maxAttempts}`)
})

// Queue-level events
queue.on("queue:paused", () => {
  console.log(`⏸️  [${new Date().toISOString()}] Queue paused`)
})

queue.on("queue:resumed", () => {
  console.log(`▶️  [${new Date().toISOString()}] Queue resumed`)
})

queue.on("queue:stopped", () => {
  console.log(`⏹️  [${new Date().toISOString()}] Queue stopped`)
})

queue.on("queue:error", (error) => {
  console.log(`🚨 [${new Date().toISOString()}] Queue error:`, error)
})

// Print stats periodically
function printStats() {
  console.log("\n📊 Queue Statistics:")
  console.log(`   Added: ${stats.added}`)
  console.log(`   Processing: ${stats.processing}`)
  console.log(`   Completed: ${stats.completed}`)
  console.log(`   Failed: ${stats.failed}`)
  console.log(`   Retried: ${stats.retried}`)
  console.log("─".repeat(50))
}

async function main() {
  await queue.connect()

  console.log("🚀 Event system example started!")
  console.log("Watch the comprehensive event logging below:\n")

  // Add various jobs to demonstrate different events
  await queue.add("reliable-task", { message: "This should work" }, { priority: 1 })
  await queue.add("unreliable-task", { message: "This might fail" }, { maxAttempts: 3 })
  await queue.add("slow-task", { message: "This takes time" }, { priority: 3 })

  // Add more unreliable tasks to show retry behavior
  for (let i = 0; i < 3; i++) {
    await queue.add("unreliable-task", { message: `Batch job ${i + 1}` }, { maxAttempts: 2 })
  }

  // Start processing
  queue.start()

  // Print stats every 5 seconds
  const statsInterval = setInterval(printStats, 5000)

  // Demonstrate queue control after 10 seconds
  setTimeout(() => {
    console.log("\n🔧 Demonstrating queue control...")
    queue.pause()

    setTimeout(() => {
      queue.resume()
    }, 2000)
  }, 10000)

  console.log("Press Ctrl+C to stop and see final statistics.")

  // Graceful shutdown
  process.on("SIGINT", async () => {
    clearInterval(statsInterval)
    console.log("\n🛑 Shutting down...")

    await queue.stop()
    await queue.disconnect()
    await client.end()

    console.log("\n📈 Final Statistics:")
    printStats()

    process.exit(0)
  })
}

main().catch(console.error)
