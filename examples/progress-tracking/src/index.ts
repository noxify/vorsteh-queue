import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { DrizzleQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import * as schema from "./schema"

// Database setup
const client = postgres(
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/queue_tracking",
)
const db = drizzle(client, { schema })

// Queue setup
const adapter = new DrizzleQueueAdapter(db, "progress-queue")
const queue = new Queue(adapter, { name: "progress-queue" })

interface ProcessDatasetPayload {
  items: string[]
  processingTime?: number
}
interface ProcessDatasetResult {
  processed: number
  completedAt: string
}

// Simulate processing large datasets with progress updates
queue.register<ProcessDatasetPayload, ProcessDatasetResult>("process-dataset", async (job) => {
  const { items, processingTime = 100 } = job.payload

  console.log(`📊 Starting to process ${items.length} items...`)

  for (let i = 0; i < items.length; i++) {
    // Simulate processing work
    await new Promise((resolve) => setTimeout(resolve, processingTime))

    // Update progress
    const progress = Math.round(((i + 1) / items.length) * 100)
    await job.updateProgress(progress)

    console.log(`   Processing item ${i + 1}/${items.length}: ${items[i]}`)
  }

  return {
    processed: items.length,
    completedAt: new Date().toISOString(),
  }
})

interface UploadFilesPayload {
  files: { name: string; size: number }[]
}
interface UploadFilesResult {
  uploadedFiles: number
  totalSize: number
}

// File upload simulation with progress
queue.register<UploadFilesPayload, UploadFilesResult>("upload-files", async (job) => {
  const { files } = job.payload

  console.log(`📁 Uploading ${files.length} files...`)
  let totalSize = files.reduce((sum, file) => sum + file.size, 0)
  let uploadedSize = 0

  for (const file of files) {
    // Simulate upload chunks
    const chunks = Math.ceil(file.size / 1024) // 1KB chunks

    for (let chunk = 0; chunk < chunks; chunk++) {
      await new Promise((resolve) => setTimeout(resolve, 50))

      const chunkSize = Math.min(1024, file.size - chunk * 1024)
      uploadedSize += chunkSize

      const progress = Math.round((uploadedSize / totalSize) * 100)
      await job.updateProgress(progress)
    }

    console.log(`   ✅ Uploaded: ${file.name} (${file.size} bytes)`)
  }

  return {
    uploadedFiles: files.length,
    totalSize: uploadedSize,
  }
})

// Progress event listeners
queue.on("job:progress", (job) => {
  console.log(`📈 Progress Update: ${job.name} is ${job.progress}% complete`)
})

queue.on("job:completed", (job) => {
  console.log(`🎉 Job completed: ${job.name}`)
})

async function main() {
  await queue.connect()

  // Add dataset processing job
  await queue.add("process-dataset", {
    items: ["user-data.csv", "transactions.json", "analytics.log", "reports.xlsx", "backup.sql"],
    processingTime: 200,
  })

  // Add file upload job
  await queue.add("upload-files", {
    files: [
      { name: "document.pdf", size: 2048 },
      { name: "image.jpg", size: 1536 },
      { name: "video.mp4", size: 4096 },
      { name: "archive.zip", size: 3072 },
    ],
  })

  // Start processing
  queue.start()

  console.log("🚀 Progress tracking example started. Watch the progress updates!")
  console.log("Press Ctrl+C to stop.")

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down...")
    await queue.stop()
    await queue.disconnect()
    await client.end()
    process.exit(0)
  })
}

main().catch(console.error)
