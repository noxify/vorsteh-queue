import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { client, db } from "./database"

// Queue setup with batch config
const queue = new Queue(new PostgresQueueAdapter(db), {
  name: "batch-demo",
  batch: { minSize: 3, maxSize: 10, waitFor: 2000 },
  removeOnComplete: 5,
  removeOnFail: 3,
})

interface FilePayload {
  file: string
}
interface FileResult {
  ok: boolean
}

// Register a batch handler for processing files
queue.registerBatch<FilePayload, FileResult>("process-files", async (jobs) => {
  console.log(`Processing batch of ${jobs.length} files...`)
  // Simulate processing
  await Promise.all(
    jobs.map(async (job) => {
      await new Promise((resolve) => setTimeout(resolve, 200))
      console.log(`  ✔️ Processed: ${job.payload.file}`)
    }),
  )
  return jobs.map(() => ({ ok: true }))
})

// Listen to batch events
queue.on("batch:processing", (jobs) => {
  console.log(`Batch processing started: ${jobs.length} jobs`)
})
queue.on("batch:completed", (jobs) => {
  console.log(`Batch completed: ${jobs.length} jobs`)
})
queue.on("batch:failed", ({ jobs, error }) => {
  console.error(`Batch failed: ${jobs.length} jobs`, error)
})

async function main() {
  console.log("🚀 Starting Batch Processing Example\n")

  // Add jobs in a batch
  await queue.addJobs("process-files", [
    { file: "a.csv" },
    { file: "b.csv" },
    { file: "c.csv" },
    { file: "d.csv" },
  ])

  // Start processing
  queue.start()
  console.log("🔄 Queue processing started!")

  // Wait for batches to complete
  setTimeout(async () => {
    await queue.stop()
    await client.end()
    console.log("✅ Batch processing complete. Shutdown.")
    process.exit(0)
  }, 5000)
}

main().catch((error) => {
  console.error("❌ Batch processing error:", error)
  process.exit(1)
})
