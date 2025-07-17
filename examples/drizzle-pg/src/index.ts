import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { DrizzleQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import * as schema from "./schema"

// Database setup
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/queue_db",
})

const db = drizzle(pool, { schema })

// Queue setup
const adapter = new DrizzleQueueAdapter(db, "example-queue")
const queue = new Queue(adapter, { name: "example-queue" })

// Job handlers
queue.register("send-email", async (payload: { to: string; subject: string }) => {
  console.log(`Sending email to ${payload.to}: ${payload.subject}`)
  await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate work
  return { sent: true }
})

queue.register("process-data", async (payload: { data: unknown[] }) => {
  console.log(`Processing ${payload.data.length} items`)
  await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate work
  return { processed: payload.data.length }
})

async function main() {
  await queue.connect()

  // Add some jobs
  await queue.add("send-email", { to: "user@example.com", subject: "Welcome!" })
  await queue.add("process-data", { data: [1, 2, 3, 4, 5] }, { priority: 1 })
  await queue.add("send-email", { to: "admin@example.com", subject: "Report" }, { delay: 5000 })

  // Start processing
  queue.start()

  console.log("Queue started. Press Ctrl+C to stop.")

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Shutting down...")
    await queue.stop()
    await queue.disconnect()
    await pool.end()
    process.exit(0)
  })
}

main().catch(console.error)
