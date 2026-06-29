import { Worker } from "@vorsteh-queue/core"

import { adapter } from "../shared/queue"

interface SendEmailPayload {
  to: string
  subject: string
  body: string
}

interface SendEmailResult {
  messageId: string
  sent: boolean
}

// Worker for the email queue
const worker = new Worker(adapter, {
  name: "email-queue",
  concurrency: 3,
  removeOnComplete: 100,
  removeOnFail: 50,
})

worker.register<SendEmailPayload, SendEmailResult>(
  "send-welcome-email",
  async (job) => {
    const { to } = job.payload
    console.log(`Sending welcome email to ${to}`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { messageId: `msg_${Date.now()}`, sent: true }
  }
)

worker.register<SendEmailPayload, SendEmailResult>(
  "send-notification",
  async (job) => {
    const { to, subject } = job.payload
    console.log(`Sending notification to ${to}: ${subject}`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    return { messageId: `notif_${Date.now()}`, sent: true }
  }
)

worker.on("job:completed", (job) => {
  console.log(`Email job completed: ${job.name} (${job.id})`)
})

worker.on("job:failed", (job) => {
  console.error(
    `Email job failed: ${job.name} (${job.id}) - ${job.error?.message}`
  )
})

async function start() {
  worker.start()
  console.log(`Email worker started (PID: ${process.pid}, concurrency: 3)`)

  process.on("SIGINT", async () => {
    console.log("Email worker shutting down...")
    await worker.stop()
    process.exit(0)
  })
}

start().catch(console.error)
