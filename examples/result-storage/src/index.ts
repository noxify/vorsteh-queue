import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue, Worker } from "@vorsteh-queue/core"

import { client, db } from "./database"
import * as schema from "./schema"

const { pushSchema } = await import("drizzle-kit/api")

interface ProcessDataPayload {
  items: string[]
  batchSize: number
}

interface ProcessDataResult {
  processed: number
  failed: number
  duration: number
}

const adapter = new PostgresQueueAdapter(db)
const queue = new Queue(adapter, { name: "result-demo" })
const worker = new Worker(adapter, {
  name: "result-demo",
  concurrency: 2,
  removeOnComplete: 10,
  removeOnFail: 5,
})

worker.register<ProcessDataPayload, ProcessDataResult>(
  "process-data",
  async (job) => {
    const startTime = Date.now()
    const { items, batchSize } = job.payload
    let processed = 0
    let failed = 0

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      for (const _item of batch) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        if (Math.random() < 0.1) {
          failed += 1
        } else {
          processed += 1
        }
      }
      await job.updateProgress(
        Math.round(((i + batch.length) / items.length) * 100)
      )
    }

    return { processed, failed, duration: Date.now() - startTime }
  }
)

worker.on("job:completed", (job) => {
  console.log(`Completed: ${job.name} - Result:`, job.result)
})

async function main() {
  console.log("Starting Result Storage Example")

  const { apply } = await pushSchema(schema, db as never)
  await apply()

  await queue.connect()

  await queue.add("process-data", {
    items: Array.from({ length: 50 }, (_, i) => `item-${i + 1}`),
    batchSize: 10,
  })

  worker.start()
  console.log("Processing... Press Ctrl+C to stop.")

  process.on("SIGINT", async () => {
    await worker.stop()
    await queue.disconnect()
    await client.close()
    process.exit(0)
  })
}

main().catch(console.error)
