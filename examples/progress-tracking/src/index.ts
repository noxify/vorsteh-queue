import { Worker } from "@vorsteh-queue/core"

import { client } from "./database"
import { adapter, queue } from "./queues"

interface ProcessDatasetPayload {
  items: string[]
  processingTime?: number
}

const worker = new Worker(adapter, {
  concurrency: 2,
  name: "progress-queue",
  removeOnComplete: 5,
  removeOnFail: 3,
})

worker.register<ProcessDatasetPayload, { processed: number }>(
  "process-dataset",
  async (job) => {
    const { items, processingTime = 100 } = job.payload
    console.log(`Processing ${items.length} items...`)

    for (let i = 0; i < items.length; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, processingTime))
      const progress = Math.round(((i + 1) / items.length) * 100)
      await job.updateProgress(progress)
      console.log(`  Item ${i + 1}/${items.length}: ${items[i]}`)
    }

    return { processed: items.length }
  }
)

// Progress bar event
worker.on("job:progress", (job) => {
  const bar =
    "#".repeat(Math.floor(job.progress / 5)) +
    ".".repeat(20 - Math.floor(job.progress / 5))
  console.log(`[${bar}] ${job.progress}%`)
})

worker.on("job:completed", (job) => {
  console.log(`Completed: ${job.name} (${job.id})`)
})

async function main() {
  console.log("Starting Progress Tracking Example\n")
  await queue.connect()

  await queue.add("process-dataset", {
    items: [
      "users.csv",
      "orders.json",
      "products.xml",
      "logs.txt",
      "metrics.db",
    ],
    processingTime: 300,
  })

  worker.start()
  console.log("Press Ctrl+C to stop.\n")

  process.on("SIGINT", async () => {
    await worker.stop()
    await queue.disconnect()
    await client.end()
    process.exit(0)
  })
}

main().catch(console.error)
