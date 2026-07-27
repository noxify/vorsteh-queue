import { MemoryQueueAdapter, Queue, Worker } from "@vorsteh-queue/core"

/**
 * Rate Limiting Example
 *
 * Limits API call handler to max 3 calls per second.
 * Jobs exceeding the limit are delayed, not rejected.
 */

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "api-queue" })
const worker = new Worker(adapter, {
  concurrency: 10,
  name: "api-queue",
  pollInterval: 50,
})

// Register handler with rate limit: max 3 per 1000ms
worker.register(
  "api-call",
  async (job) => {
    const { endpoint } = job.payload as { endpoint: string }
    const timestamp = new Date().toISOString().slice(11, 23)
    console.log(`[${timestamp}] Calling API: ${endpoint}`)
    await new Promise((resolve) => setTimeout(resolve, 100))
    return { endpoint, status: 200 }
  },
  { rateLimit: { duration: 1000, max: 3 } }
)

async function main() {
  console.log("=== Rate Limiting Example ===")
  console.log("Max 3 API calls per second\n")
  await queue.connect()

  // Add 10 jobs quickly
  for (let i = 1; i <= 10; i += 1) {
    await queue.add("api-call", { endpoint: `/users/${i}` })
  }
  console.log("10 jobs added\n")

  worker.start()

  // Watch for 4 seconds
  await new Promise((resolve) => setTimeout(resolve, 4000))

  const stats = await queue.getStats()
  console.log(`\nCompleted: ${stats.completed}`)

  await worker.stop()
  await queue.disconnect()
}

main().catch(console.error)
