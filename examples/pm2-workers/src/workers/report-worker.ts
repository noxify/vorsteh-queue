import { reportQueue as queue } from "../shared/queue"

interface GenerateReportPayload {
  reportType: string
  dateRange: { start: string; end: string }
  userId: string
  format: "pdf" | "csv" | "xlsx"
}

interface GenerateReportResult {
  reportId: string
  url: string
  size: number
}

// Report generation job handlers
queue.register<GenerateReportPayload, GenerateReportResult>(
  "generate-monthly-report",
  async (job) => {
    const { reportType, dateRange, userId, format } = job.payload

    console.log(`📊 Generating ${reportType} report for user ${userId} (${format})`)
    console.log(`   Date range: ${dateRange.start} to ${dateRange.end}`)

    // Simulate report generation steps
    const steps = [
      "Fetching data",
      "Processing analytics",
      "Generating charts",
      "Formatting document",
      "Finalizing report",
    ]

    for (let i = 0; i < steps.length; i++) {
      console.log(`   ${steps[i]}...`)
      await new Promise((resolve) => setTimeout(resolve, 3000))

      const progress = Math.round(((i + 1) / steps.length) * 100)
      await job.updateProgress(progress)
    }

    const reportId = `report_${Date.now()}`

    return {
      reportId,
      url: `https://reports.example.com/${reportId}.${format}`,
      size: Math.floor(Math.random() * 5000000) + 1000000, // 1-5MB
    }
  },
)

queue.register<GenerateReportPayload, GenerateReportResult>(
  "generate-analytics-dashboard",
  async (job) => {
    const { reportType, userId } = job.payload

    console.log(`📈 Generating analytics dashboard for user ${userId}`)

    // Simulate dashboard generation
    const widgets = [
      "Revenue Chart",
      "User Growth",
      "Conversion Funnel",
      "Geographic Data",
      "Performance Metrics",
    ]

    for (let i = 0; i < widgets.length; i++) {
      console.log(`   Building ${widgets[i]}...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      const progress = Math.round(((i + 1) / widgets.length) * 100)
      await job.updateProgress(progress)
    }

    const reportId = `dashboard_${Date.now()}`

    return {
      reportId,
      url: `https://dashboards.example.com/${reportId}`,
      size: 2500000, // ~2.5MB
    }
  },
)

// Event monitoring
queue.on("job:completed", (job) => {
  console.log(`✅ Report job completed: ${job.name} (${job.id})`)
})

queue.on("job:failed", (job) => {
  console.error(`❌ Report job failed: ${job.name} (${job.id}) - ${job.error}`)
})

async function startReportWorker() {
  await queue.connect()
  queue.start()

  const config = queue.getConfig()
  console.log(`🚀 Report worker started (PID: ${process.pid})`)
  console.log(`📊 Queue: ${config.name}, Concurrency: ${config.concurrency}`)
  console.log(
    `⚙️  Config: removeOnComplete=${config.removeOnComplete}, removeOnFail=${config.removeOnFail}`,
  )

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("📊 Report worker shutting down...")
    await queue.stop()
    await queue.disconnect()
    process.exit(0)
  })
}

startReportWorker().catch(console.error)
