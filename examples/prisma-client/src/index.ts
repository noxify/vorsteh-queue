import { PrismaPg } from "@prisma/adapter-pg"

import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
import { Queue } from "@vorsteh-queue/core"

import { PrismaClient } from "./generated/prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const queue = new Queue(new PostgresPrismaQueueAdapter(prisma), {
  name: "email-queue",
  concurrency: 2,
})

interface EmailPayload {
  to: string
  subject: string
  body: string
}

interface EmailResult {
  sent: boolean
}

queue.register<EmailPayload, EmailResult>("send-email", async (job) => {
  console.log(`📧 Sending email to ${job.payload.to}`)
  console.log(`Subject: ${job.payload.subject}`)

  await job.updateProgress(50)
  await new Promise((resolve) => setTimeout(resolve, 1000))

  await job.updateProgress(100)

  console.log(`✅ Email sent to ${job.payload.to}`)
  return { sent: true }
})

queue.on("job:completed", (job) => {
  console.log(`🎉 Job ${job.name} completed`)
})

queue.on("job:failed", (job) => {
  console.error(`❌ Job ${job.name} failed:`, job.error)
})

async function main() {
  await queue.connect()
  console.log("🔌 Connected to database")

  await queue.add("send-email", {
    to: "user@example.com",
    subject: "Welcome!",
    body: "Welcome to our service!",
  })

  queue.start()
  console.log("🚀 Queue started")

  // Start processing
  queue.start()
  console.log("🔄 Queue processing started. Press Ctrl+C to stop.")

  // Show stats periodically
  const statsInterval = setInterval(async () => {
    const stats = await queue.getStats()
    console.log("📊 Queue Stats:", stats)
  }, 10000)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...")
    clearInterval(statsInterval)
    await queue.stop()

    await queue.disconnect()
    console.log("✅ Shutdown complete")
    process.exit(0)
  })
}

main().catch(console.error)
