import { PrismaClient } from "./generated/prisma/index.ts"
import { Queue } from "@vorsteh-queue/core"
import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"

const prisma = new PrismaClient()

const queue = new Queue(new PostgresPrismaQueueAdapter(prisma), {
  name: "email-queue",
  concurrency: 2,
})

interface EmailPayload {
  to: string
  subject: string
  body: string
}

queue.register<EmailPayload>("send-email", async (job) => {
  console.log(`📧 Sending email to ${job.payload.to}`)
  console.log(`Subject: ${job.payload.subject}`)
  
  await job.updateProgress(50)
  await new Promise(resolve => setTimeout(resolve, 1000))
  
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
    body: "Welcome to our service!"
  })

  queue.start()
  console.log("🚀 Queue started")

  await new Promise(resolve => setTimeout(resolve, 5000))
  
  await queue.stop()
  await queue.disconnect()
  console.log("👋 Queue stopped")
}

main().catch(console.error)