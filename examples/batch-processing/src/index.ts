import { Worker } from "@vorsteh-queue/core"

import { client } from "./database"
import { adapter, queue } from "./queues"

interface FilePayload {
  file: string
}

interface FileResult {
  ok: boolean
}

const worker = new Worker(adapter, {
  concurrency: 2,
  name: "batch-demo",
  removeOnComplete: 5,
  removeOnFail: 3,
})

// Register a batch handler
worker.registerBatch<FilePayload, FileResult>(
  "process-files",
  async (jobs) => {
    console.log(`Processing batch of ${jobs.length} files...`)
    await Promise.all(
      jobs.map(async (job) => {
        await new Promise((resolve) => setTimeout(resolve, 200))
        console.log(`  Processed: ${job.payload.file}`)
      })
    )
    return jobs.map(() => ({ ok: true }))
  },
  { maxSize: 10, minSize: 3, waitFor: 2000 }
)

async function main() {
  console.log("Starting Batch Processing Example")
  await queue.connect()

  worker.on("batch:processing", (jobs) => {
    console.log(`Batch started: ${jobs.length} jobs`)
  })

  worker.on("batch:completed", (jobs) => {
    console.log(`Batch completed: ${jobs.length} jobs`)
  })

  // Add files to process
  const files = [
    "report.pdf",
    "data.csv",
    "image.png",
    "backup.sql",
    "logs.txt",
  ]

  await queue.addJobs(
    "process-files",
    files.map((file) => ({ file }))
  )

  worker.start()
  console.log(`${files.length} files queued. Press Ctrl+C to stop.`)

  process.on("SIGINT", async () => {
    await worker.stop()
    await queue.disconnect()
    await client.end()
    process.exit(0)
  })
}

main().catch(console.error)
