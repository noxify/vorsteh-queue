import { emailQueue as queue } from "../shared/queue"

interface SendEmailPayload {
  to: string
  subject: string
  body: string
  template?: string
}

interface SendEmailResult {
  messageId: string
  sent: boolean
}

// Email job handlers
queue.register<SendEmailPayload, SendEmailResult>("send-welcome-email", async (job) => {
  const { to } = job.payload

  console.log(`📧 Sending welcome email to ${to}`)

  // Simulate email sending
  await new Promise((resolve) => setTimeout(resolve, 1000))

  return {
    messageId: `msg_${Date.now()}`,
    sent: true,
  }
})

queue.register<SendEmailPayload, SendEmailResult>("send-notification", async (job) => {
  const { to, subject } = job.payload

  console.log(`🔔 Sending notification to ${to}: ${subject}`)

  // Simulate email sending with progress
  for (let i = 0; i <= 100; i += 25) {
    await job.updateProgress(i)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  return {
    messageId: `notif_${Date.now()}`,
    sent: true,
  }
})

// Event monitoring
queue.on("job:completed", (job) => {
  console.log(`✅ Email job completed: ${job.name} (${job.id})`)
})

queue.on("job:failed", (job) => {
  console.error(`❌ Email job failed: ${job.name} (${job.id}) - ${job.error}`)
})

async function startEmailWorker() {
  await queue.connect()
  queue.start()

  const config = queue.getConfig()
  console.log(`🚀 Email worker started (PID: ${process.pid})`)
  console.log(`📊 Queue: ${config.name}, Concurrency: ${config.concurrency}`)
  console.log(`⚙️  Config: removeOnComplete=${config.removeOnComplete}, removeOnFail=${config.removeOnFail}`)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("📧 Email worker shutting down...")
    await queue.stop()
    await queue.disconnect()
    process.exit(0)
  })
}

startEmailWorker().catch(console.error)
