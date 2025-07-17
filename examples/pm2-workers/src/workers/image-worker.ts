import { imageQueue as queue } from "../shared/queue"

interface ProcessImagePayload {
  imageId: string
  sizes: number[]
  format?: string
}

interface ProcessImageResult {
  imageId: string
  processedSizes: number[]
  urls: string[]
}

// Image processing job handlers
queue.register<ProcessImagePayload, ProcessImageResult>("resize-image", async (job) => {
  const { imageId, sizes, format = "jpg" } = job.payload

  console.log(`🖼️  Resizing image ${imageId} to sizes: ${sizes.join(", ")}`)

  const urls: string[] = []

  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i]

    // Simulate image processing
    console.log(`   Processing ${size}x${size}...`)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Update progress
    const progress = Math.round(((i + 1) / sizes.length) * 100)
    await job.updateProgress(progress)

    urls.push(`https://cdn.example.com/${imageId}_${size}x${size}.${format}`)
  }

  return {
    imageId,
    processedSizes: sizes,
    urls,
  }
})

queue.register<ProcessImagePayload, ProcessImageResult>("optimize-image", async (job) => {
  const { imageId } = job.payload

  console.log(`⚡ Optimizing image ${imageId}`)

  // Simulate optimization steps
  const steps = ["Loading", "Compressing", "Optimizing", "Saving"]

  for (let i = 0; i < steps.length; i++) {
    console.log(`   ${steps[i]}...`)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const progress = Math.round(((i + 1) / steps.length) * 100)
    await job.updateProgress(progress)
  }

  return {
    imageId,
    processedSizes: [1920],
    urls: [`https://cdn.example.com/${imageId}_optimized.webp`],
  }
})

// Event monitoring
queue.on("job:completed", (job) => {
  console.log(`✅ Image job completed: ${job.name} (${job.id})`)
})

queue.on("job:failed", (job) => {
  console.error(`❌ Image job failed: ${job.name} (${job.id}) - ${job.error}`)
})

async function startImageWorker() {
  await queue.connect()
  queue.start()

  const config = queue.getConfig()
  console.log(`🚀 Image worker started (PID: ${process.pid})`)
  console.log(`📊 Queue: ${config.name}, Concurrency: ${config.concurrency}`)
  console.log(
    `⚙️  Config: removeOnComplete=${config.removeOnComplete}, removeOnFail=${config.removeOnFail}`,
  )

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("🖼️  Image worker shutting down...")
    await queue.stop()
    await queue.disconnect()
    process.exit(0)
  })
}

startImageWorker().catch(console.error)
