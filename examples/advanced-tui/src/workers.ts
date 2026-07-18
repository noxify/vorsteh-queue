import { Worker } from "@vorsteh-queue/core"

import { adapter } from "./queues"

// ─── Email Worker ────────────────────────────────────────────────────────────

export const emailWorker = new Worker(adapter, {
  concurrency: 2,
  name: "email",
  pollInterval: 500,
})

emailWorker.register("send-welcome", async () => {
  await delay(randomBetween(800, 2000))
  return { messageId: `msg_${Date.now()}`, sent: true }
})

emailWorker.register("send-digest", async (job) => {
  await delay(randomBetween(1000, 3000))
  // Simulate occasional failures
  if (Math.random() < 0.3) {
    throw new Error("SMTP connection timeout")
  }
  const payload = job.payload as { count?: number }
  return { recipients: payload.count ?? 1, sent: true }
})

emailWorker.register("send-invoice", async () => {
  await delay(randomBetween(500, 1500))
  return { invoiceId: `inv_${Date.now()}`, sent: true }
})

// ─── Data Processing Worker ──────────────────────────────────────────────────

export const dataWorker = new Worker(adapter, {
  concurrency: 1,
  name: "data-processing",
  pollInterval: 500,
})

dataWorker.register("generate-report", async (job) => {
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    await delay(randomBetween(300, 800))
    await job.updateProgress(Math.round((i / steps) * 100))
  }
  return { format: "pdf", pages: randomBetween(5, 50) }
})

dataWorker.register("import-csv", async (job) => {
  const payload = job.payload as { rows?: number }
  const rows = payload.rows ?? 1000
  const batchSize = 100
  for (let i = 0; i < rows; i += batchSize) {
    await delay(randomBetween(200, 500))
    await job.updateProgress(Math.round(((i + batchSize) / rows) * 100))
  }
  return { errors: randomBetween(0, 5), imported: rows }
})

dataWorker.register("cleanup-old-data", async () => {
  await delay(randomBetween(2000, 5000))
  // Simulate occasional failures
  if (Math.random() < 0.2) {
    throw new Error("Lock timeout exceeded")
  }
  return { deleted: randomBetween(100, 5000) }
})

dataWorker.register("aggregate-metrics", async () => {
  await delay(randomBetween(1000, 3000))
  return { metrics: randomBetween(10, 100), period: "hourly" }
})

// ─── Notification Worker ─────────────────────────────────────────────────────

export const notificationWorker = new Worker(adapter, {
  concurrency: 3,
  name: "notifications",
  pollInterval: 300,
})

notificationWorker.register("push-notification", async (job) => {
  await delay(randomBetween(200, 800))
  if (Math.random() < 0.1) {
    throw new Error("Push service unavailable")
  }
  const payload = job.payload as { platform?: string }
  return { delivered: true, platform: payload.platform ?? "ios" }
})

notificationWorker.register("slack-alert", async (job) => {
  await delay(randomBetween(300, 1000))
  const payload = job.payload as { channel?: string }
  return { channel: payload.channel ?? "#general", ok: true }
})

notificationWorker.register("webhook", async (job) => {
  await delay(randomBetween(500, 2000))
  const payload = job.payload as { url?: string }
  if (Math.random() < 0.15) {
    throw new Error(`HTTP 503 from ${payload.url ?? "unknown"}`)
  }
  return { responseTime: randomBetween(50, 500), statusCode: 200 }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
