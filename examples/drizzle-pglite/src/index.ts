import { Worker } from "@vorsteh-queue/core"

import { client, db } from "./database"
import { adapter, queue } from "./queues"
import * as schema from "./schema"

// Import pushSchema from drizzle-kit/api
// Source: https://github.com/drizzle-team/drizzle-orm/issues/4205
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports, node/global-require, unicorn/prefer-module */
const { pushSchema } =
  require("drizzle-kit/api") as typeof import("drizzle-kit/api")
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports, node/global-require, unicorn/prefer-module */

// Job payload types
interface EmailJob {
  to: string
  subject: string
  body?: string
}

interface DataProcessingJob {
  data: unknown[]
  batchSize?: number
}

// Job result types
interface EmailResult {
  sent: boolean
  messageId: string
}

interface DataProcessingResult {
  processed: number
  results: unknown[]
}

// Worker setup (consumer)
const worker = new Worker(adapter, {
  name: "example-queue",
  concurrency: 2,
})

// Job handlers with proper types
worker.register<EmailJob, EmailResult>("send-email", async (job) => {
  console.log(`Sending email to ${job.payload.to}: ${job.payload.subject}`)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  return {
    sent: true,
    messageId: `msg_${Date.now()}`,
  }
})

worker.register<DataProcessingJob, DataProcessingResult>(
  "process-data",
  async (job) => {
    const { data, batchSize = 10 } = job.payload
    console.log(`Processing ${data.length} items in batches of ${batchSize}`)

    const results = []
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      await new Promise((resolve) => setTimeout(resolve, 500))
      results.push(...batch)

      // Update progress
      const progress = Math.round(((i + batch.length) / data.length) * 100)
      await job.updateProgress(progress)
    }

    return { processed: results.length, results }
  }
)

async function main() {
  console.log("Starting PGlite Queue Example (Embedded PostgreSQL)")

  // Initialize database schema (PGlite starts empty)
  console.log("Initializing database schema...")
  const { apply } = await pushSchema(schema, db as never)
  await apply()
  console.log("Database schema initialized")

  // Queue events (producer-side)
  queue.on("job:added", (job) => {
    console.log(`Job added: ${job.name} (${job.id})`)
  })

  // Worker events (consumer-side)
  worker.on("job:processing", (job) => {
    console.log(`Processing: ${job.name} (${job.id})`)
  })

  worker.on("job:completed", (job) => {
    console.log(`Completed: ${job.name} (${job.id})`)
  })

  worker.on("job:failed", (job) => {
    console.error(`Failed: ${job.name} (${job.id}) - ${job.error}`)
  })

  worker.on("job:progress", (job) => {
    console.log(`Progress: ${job.name} - ${job.progress}%`)
  })

  // Add some jobs
  await queue.add<EmailJob>("send-email", {
    to: "user@example.com",
    subject: "Welcome!",
    body: "Thanks for joining us!",
  })

  await queue.add<DataProcessingJob>(
    "process-data",
    {
      data: Array.from({ length: 20 }, (_, i) => `item-${i + 1}`),
      batchSize: 5,
    },
    { priority: 1 }
  )

  await queue.add<EmailJob>(
    "send-email",
    {
      to: "admin@example.com",
      subject: "System Report",
      body: "Daily system status",
    },
    { delay: 5000 }
  )

  // Start processing
  worker.start()
  console.log("Queue processing started. Press Ctrl+C to stop.")

  // Show stats periodically
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("Queue Stats:", stats)
  }, 10_000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...")
    clearInterval(statsInterval)
    await worker.stop()
    await client.close()
    console.log("Shutdown complete")
    process.exit(0)
  })
}

main().catch(console.error)
