import { emailQueue, imageQueue, reportQueue } from "./shared/queue"

// Create queues for adding jobs

async function addSampleJobs() {
  await emailQueue.connect()
  await imageQueue.connect()
  await reportQueue.connect()

  console.log("🎯 Adding sample jobs to queues...")

  // Add email jobs
  await emailQueue.add("send-welcome-email", {
    to: "user@example.com",
    subject: "Welcome to our platform!",
    body: "Thank you for signing up...",
  })

  await emailQueue.add(
    "send-notification",
    {
      to: "admin@example.com",
      subject: "New user registration",
      body: "A new user has registered...",
    },
    { priority: 1 },
  )

  // Add image processing jobs
  await imageQueue.add("resize-image", {
    imageId: "img_001",
    sizes: [150, 300, 600, 1200],
    format: "webp",
  })

  await imageQueue.add("optimize-image", {
    imageId: "img_002",
    sizes: [1920],
  })

  // Add report generation jobs
  await reportQueue.add("generate-monthly-report", {
    reportType: "sales",
    dateRange: { start: "2024-01-01", end: "2024-01-31" },
    userId: "user_123",
    format: "pdf",
  })

  await reportQueue.add("generate-analytics-dashboard", {
    reportType: "analytics",
    dateRange: { start: "2024-01-01", end: "2024-01-31" },
    userId: "user_456",
    format: "pdf",
  })

  // Add recurring jobs
  await emailQueue.add(
    "send-newsletter",
    {
      to: "subscribers@example.com",
      subject: "Weekly Newsletter",
      body: "This week's updates...",
    },
    {
      cron: "0 9 * * 1", // Every Monday at 9 AM
      timezone: "America/New_York",
    },
  )

  await reportQueue.add(
    "generate-weekly-summary",
    {
      reportType: "summary",
      dateRange: { start: "2024-01-01", end: "2024-01-07" },
      userId: "admin",
      format: "xlsx",
    },
    {
      cron: "0 8 * * 0", // Every Sunday at 8 AM
      timezone: "UTC",
    },
  )

  console.log("✅ Sample jobs added successfully!", new Date().toISOString())
  console.log("\n📊 Queue Status:")

  const emailStats = await emailQueue.getStats()
  const imageStats = await imageQueue.getStats()
  const reportStats = await reportQueue.getStats()

  console.log(
    `Email Queue: ${emailStats.pending} pending, ${emailStats.delayed} delayed, ${emailStats.completed} completed, ${emailStats.failed} failed, ${emailStats.processing} processing`,
  )
  console.log(
    `Image Queue: ${imageStats.pending} pending, ${imageStats.delayed} delayed, ${imageStats.completed} completed, ${imageStats.failed} failed, ${imageStats.processing} processing`,
  )

  console.log(
    `Report Queue: ${reportStats.pending} pending, ${reportStats.delayed} delayed ${reportStats.completed} completed, ${reportStats.failed} failed, ${reportStats.processing} processing`,
  )

  await emailQueue.disconnect()
  await imageQueue.disconnect()
  await reportQueue.disconnect()
}

// Add jobs periodically for demo
async function startProducer() {
  console.log("🏭 Producer started - adding jobs every 30 seconds")

  // Add initial batch
  await addSampleJobs()

  // Add more jobs periodically
  setInterval(async () => {
    try {
      await addSampleJobs()
    } catch (error) {
      console.error("Error adding jobs:", error)
    }
  }, 30000)
}

if (process.argv.includes("--continuous")) {
  startProducer().catch(console.error)
} else {
  addSampleJobs().catch(console.error)
}
