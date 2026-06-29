import { PrismaPg } from "@prisma/adapter-pg"
import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
import { Queue, Worker } from "@vorsteh-queue/core"

import { PrismaClient } from "./generated/prisma/client"

const prismaAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter: prismaAdapter })

const queueAdapter = new PostgresPrismaQueueAdapter(prisma)
const queue = new Queue(queueAdapter, { name: "email-queue" })
const worker = new Worker(queueAdapter, { name: "email-queue", concurrency: 2 })

interface EmailPayload {
  to: string
  subject: string
  body: string
}

interface EmailResult {
  sent: boolean
}

worker.register<EmailPayload, EmailResult>("send-email", async (job) => {
  console.log(`Sending email to ${job.payload.to}`)
  console.log(`Subject: ${job.payload.subject}`)

  await job.updateProgress(50)
  await new Promise((resolve) => setTimeout(resolve, 1000))
  await job.updateProgress(100)

  console.log(`Email sent to ${job.payload.to}`)
  return { sent: true }
})

worker.on("job:completed", (job) => {
  console.log(`Job ${job.name} completed`)
})

worker.on("job:failed", (job) => {
  console.error(`Job ${job.name} failed: ${job.error?.message}`)
})

async function main() {
  await queue.connect()
  console.log("Connected to database")

  await queue.add("send-email", {
    to: "user@example.com",
    subject: "Welcome!",
    body: "Welcome to our service!",
  })

  worker.start()
  console.log("Worker started. Press Ctrl+C to stop.")

  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("Queue Stats:", stats)
  }, 10_000)

  process.on("SIGINT", async () => {
    console.log("\nShutting down...")
    clearInterval(statsInterval)
    await worker.stop()
    await queue.disconnect()
    console.log("Shutdown complete")
    process.exit(0)
  })
}

main().catch(console.error)
