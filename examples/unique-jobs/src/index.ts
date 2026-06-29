import {
  DuplicateJobError,
  MemoryQueueAdapter,
  Queue,
  Worker,
} from "@vorsteh-queue/core"

/**
 * Unique Jobs Example: Deduplication
 *
 * Shows two modes:
 * - "reject": Throws DuplicateJobError if a job with the same key exists
 * - "replace": Cancels the existing job and creates a new one
 */

const adapter = new MemoryQueueAdapter()
const queue = new Queue(adapter, { name: "unique-queue" })
const worker = new Worker(adapter, { name: "unique-queue", pollInterval: 50 })

worker.register("sync-user", async (job) => {
  const { userId } = job.payload as { userId: string }
  console.log(`Syncing user ${userId}...`)
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { synced: true, userId }
})

async function main() {
  console.log("=== Unique Jobs Example ===\n")
  await queue.connect()

  // --- Mode 1: Reject duplicates ---
  console.log("--- Mode: reject ---")
  await queue.add(
    "sync-user",
    { userId: "user-1" },
    {
      unique: { key: "sync:user-1", action: "reject" },
    }
  )
  console.log("First job added successfully")

  try {
    await queue.add(
      "sync-user",
      { userId: "user-1" },
      {
        unique: { key: "sync:user-1", action: "reject" },
      }
    )
  } catch (error) {
    if (error instanceof DuplicateJobError) {
      console.log(`Duplicate rejected: ${error.message}`)
    }
  }

  // --- Mode 2: Replace duplicates ---
  console.log("\n--- Mode: replace ---")
  const first = await queue.add(
    "sync-user",
    { userId: "user-2", version: 1 },
    {
      unique: { key: "sync:user-2", action: "replace" },
    }
  )
  console.log(`First job: ${first.id}`)

  const second = await queue.add(
    "sync-user",
    { userId: "user-2", version: 2 },
    {
      unique: { key: "sync:user-2", action: "replace" },
    }
  )
  console.log(`Second job (replaced first): ${second.id}`)

  const oldJob = await queue.getJob(first.id)
  console.log(`First job status: ${oldJob?.status} (cancelled by replacement)`)

  // Process remaining jobs
  worker.start()
  await new Promise((resolve) => setTimeout(resolve, 1000))

  const stats = await queue.getStats()
  console.log("\nFinal stats:", stats)

  await worker.stop()
  await queue.disconnect()
}

main().catch(console.error)
