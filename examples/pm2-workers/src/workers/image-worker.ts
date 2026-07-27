import { Worker } from "@vorsteh-queue/core"

import { adapter } from "../shared/queue"

interface ProcessImagePayload {
  imageId: string
  sizes: number[]
  format?: string
}

interface ProcessImageResult {
  imageId: string
  urls: string[]
}

const worker = new Worker(adapter, {
  concurrency: 2,
  name: "image-queue",
  removeOnComplete: 50,
  removeOnFail: 20,
})

worker.register<ProcessImagePayload, ProcessImageResult>(
  "resize-image",
  async (job) => {
    const { imageId, sizes, format = "jpg" } = job.payload
    console.log(`Resizing image ${imageId} to sizes: ${sizes.join(", ")}`)

    const urls: string[] = []
    for (let i = 0; i < sizes.length; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await job.updateProgress(Math.round(((i + 1) / sizes.length) * 100))
      urls.push(
        `https://cdn.example.com/${imageId}_${sizes[i]}x${sizes[i]}.${format}`
      )
    }
    return { imageId, urls }
  }
)

worker.on("job:completed", (job) => {
  console.log(`Image job completed: ${job.name} (${job.id})`)
})

async function start() {
  worker.start()
  console.log(`Image worker started (PID: ${process.pid}, concurrency: 2)`)

  process.on("SIGINT", async () => {
    await worker.stop()
    process.exit(0)
  })
}

start().catch(console.error)
