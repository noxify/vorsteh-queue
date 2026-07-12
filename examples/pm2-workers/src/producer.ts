import { emailQueue, imageQueue, reportQueue } from "./shared/queue"

// Create queues for adding jobs

async function addSampleJobs() {
  await emailQueue.connect()
  await imageQueue.connect()
  await reportQueue.connect()

  console.log("Adding sample jobs to queues...")

  // Add email jobs
  await emailQueue.add("send-welcome-email", {
    body: "Thank you for signing up...",
    subject: "Welcome to our platform!",
    to: "user@example.com",
  })

  await emailQueue.add(
    "send-notification",
    {
      body: "A new user has registered...",
      subject: "New user registration",
      to: "admin@example.com",
    },
    { priority: 1 }
  )

  // Add image processing jobs
  await imageQueue.add("resize-image", {
    format: "webp",
    imageId: "img_001",
    sizes: [150, 300, 600, 1200],
  })

  await imageQueue.add("optimize-image", {
    imageId: "img_002",
    sizes: [1920],
  })

  // Add report generation jobs
  await reportQueue.add("generate-monthly-report", {
    dateRange: { end: "2024-01-31", start: "2024-01-01" },
    format: "pdf",
    reportType: "sales",
    userId: "user_123",
  })

  await reportQueue.add("generate-analytics-dashboard", {
    dateRange: { end: "2024-01-31", start: "2024-01-01" },
    format: "pdf",
    reportType: "analytics",
    userId: "user_456",
  })

  // Add recurring jobs
  await emailQueue.add(
    "send-notification",
    {
      body: "This week's updates...",
      subject: "Weekly Newsletter",
      to: "subscribers@example.com",
    },
    {
      cron: "0 9 * * 1", // Every Monday at 9 AM
      timezone: "America/New_York",
    }
  )

  await reportQueue.add(
    "generate-monthly-report",
    {
      dateRange: { end: "2024-01-07", start: "2024-01-01" },
      format: "xlsx",
      reportType: "summary",
      userId: "admin",
    },
    {
      cron: "0 8 * * 0", // Every Sunday at 8 AM
      timezone: "UTC",
    }
  )

  console.log("Sample jobs added successfully!", new Date().toISOString())
  console.log("\nQueue Status:")

  const emailStats = await emailQueue.getStats()
  const imageStats = await imageQueue.getStats()
  const reportStats = await reportQueue.getStats()

  console.log(
    `Email Queue: ${emailStats.pending} pending, ${emailStats.delayed} delayed, ${emailStats.completed} completed, ${emailStats.failed} failed, ${emailStats.processing} processing`
  )
  console.log(
    `Image Queue: ${imageStats.pending} pending, ${imageStats.delayed} delayed, ${imageStats.completed} completed, ${imageStats.failed} failed, ${imageStats.processing} processing`
  )
  console.log(
    `Report Queue: ${reportStats.pending} pending, ${reportStats.delayed} delayed, ${reportStats.completed} completed, ${reportStats.failed} failed, ${reportStats.processing} processing`
  )

  await emailQueue.disconnect()
  await imageQueue.disconnect()
  await reportQueue.disconnect()
}

// Add jobs periodically for demo
async function startProducer() {
  console.log("Producer started - adding jobs every 30 seconds")

  // Add initial batch
  await addSampleJobs()

  // Add more jobs periodically
  setInterval(async () => {
    try {
      await addSampleJobs()
    } catch (error) {
      console.error("Error adding jobs:", error)
    }
  }, 30_000)
}

if (process.argv.includes("--continuous")) {
  startProducer().catch(console.error)
} else {
  addSampleJobs().catch(console.error)
}
