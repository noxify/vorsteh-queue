import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db, client } from "./database"

// Queue setup
const adapter = new PostgresQueueAdapter(db, "progress-queue")
const queue = new Queue(adapter, { 
  name: "progress-queue",
  removeOnComplete: 5,
  removeOnFail: 3
})

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

// Enhanced event listeners
queue.on("job:added", (job) => {
  console.log(`✅ Job added: ${job.name} (${job.id})`)
})

queue.on("job:processing", (job) => {
  console.log(`⚡ Started processing: ${job.name} (${job.id})`)
})

queue.on("job:progress", (job) => {
  const progressBar = '█'.repeat(Math.floor(job.progress / 5)) + '░'.repeat(20 - Math.floor(job.progress / 5))
  console.log(`📈 Progress: ${job.name} [${progressBar}] ${job.progress}%`)
})

queue.on("job:completed", (job) => {
  console.log(`🎉 Completed: ${job.name} (${job.id}) - Duration: ${Date.now() - job.createdAt.getTime()}ms`)
})

queue.on("job:failed", (job) => {
  console.error(`❌ Failed: ${job.name} (${job.id}) - ${job.error}`)
})

async function main() {
  console.log("🚀 Starting Progress Tracking Example")
  console.log("Watch the real-time progress bars and updates!\n")

  // Add multiple dataset processing jobs
  await queue.add<ProcessDatasetPayload>("process-dataset", {
    items: ["user-data.csv", "transactions.json", "analytics.log", "reports.xlsx", "backup.sql"],
    processingTime: 300,
  })

  await queue.add<ProcessDatasetPayload>("process-dataset", {
    items: Array.from({ length: 15 }, (_, i) => `batch-${i + 1}.json`),
    processingTime: 150,
  }, { priority: 1 })

  // Add file upload jobs with different sizes
  await queue.add<UploadFilesPayload>("upload-files", {
    files: [
      { name: "document.pdf", size: 2048 },
      { name: "image.jpg", size: 1536 },
      { name: "video.mp4", size: 8192 },
      { name: "archive.zip", size: 4096 },
    ],
  })

  await queue.add<UploadFilesPayload>("upload-files", {
    files: [
      { name: "large-dataset.csv", size: 12288 },
      { name: "backup.tar.gz", size: 16384 },
    ],
  }, { delay: 3000 })

  // Start processing
  queue.start()
  console.log("🔄 Queue processing started with progress tracking!")
  console.log("Press Ctrl+C to stop.\n")

  // Show queue stats with progress info
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    if (stats.processing > 0) {
      console.log(`📊 Active jobs: ${stats.processing} processing, ${stats.pending} pending`)
    }
  }, 5000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down progress tracking...")
    clearInterval(statsInterval)
    await queue.stop()
    await client.end()
    console.log("✅ Progress tracking shutdown complete")
    process.exit(0)
  })
}

main().catch((error) => {
  console.error("❌ Progress tracking error:", error)
  process.exit(1)
})
