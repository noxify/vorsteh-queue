import { Worker } from "@vorsteh-queue/core"

import { adapter } from "../shared/queue"

interface ReportPayload {
  reportType: string
  dateRange: { start: string; end: string }
  userId: string
  format: "pdf" | "csv" | "xlsx"
}

interface ReportResult {
  reportId: string
  url: string
}

const worker = new Worker(adapter, {
  concurrency: 1,
  name: "report-queue",
  removeOnComplete: 20,
  removeOnFail: 10,
})

worker.register<ReportPayload, ReportResult>(
  "generate-monthly-report",
  async (job) => {
    const { reportType, userId, format } = job.payload
    console.log(`Generating ${reportType} report for ${userId} (${format})`)

    const steps = ["Fetching data", "Processing", "Generating", "Finalizing"]
    for (let i = 0; i < steps.length; i += 1) {
      console.log(`  ${steps[i]}...`)
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await job.updateProgress(Math.round(((i + 1) / steps.length) * 100))
    }

    const reportId = `report_${Date.now()}`
    return {
      reportId,
      url: `https://reports.example.com/${reportId}.${format}`,
    }
  }
)

worker.on("job:completed", (job) => {
  console.log(`Report completed: ${job.name} (${job.id})`)
})

async function start() {
  worker.start()
  console.log(`Report worker started (PID: ${process.pid}, concurrency: 1)`)

  process.on("SIGINT", async () => {
    await worker.stop()
    process.exit(0)
  })
}

start().catch(console.error)
