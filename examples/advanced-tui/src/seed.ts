import { dataQueue, emailQueue, notificationQueue } from "./queues"

/**
 * Seeds the queues with diverse job types for TUI dashboard testing.
 * Covers: one-time, delayed, recurring (cron), dependencies, priorities,
 * groups, unique keys, and flow trees.
 */
export async function seedJobs(): Promise<void> {
  // ─── Email Queue ─────────────────────────────────────────────────────────

  // One-time jobs with varying priorities
  await emailQueue.add(
    "send-welcome",
    { to: "alice@example.com" },
    { priority: 1 }
  )
  await emailQueue.add(
    "send-welcome",
    { to: "bob@example.com" },
    { priority: 1 }
  )
  await emailQueue.add(
    "send-welcome",
    { to: "charlie@example.com" },
    { priority: 2 }
  )

  // Delayed job
  await emailQueue.add(
    "send-invoice",
    { to: "billing@corp.com", amount: 499.99 },
    { delay: 10_000 }
  )

  // Recurring digest email (every 30 seconds for demo purposes)
  await emailQueue.add(
    "send-digest",
    { count: 50, type: "daily-summary" },
    { cron: "*/30 * * * * *" }
  )

  // Grouped jobs (FIFO per customer)
  await emailQueue.add(
    "send-welcome",
    { to: "vip@example.com", template: "premium" },
    { group: "customer-vip", priority: 0 }
  )
  await emailQueue.add(
    "send-invoice",
    { to: "vip@example.com", amount: 1299 },
    { group: "customer-vip", priority: 0 }
  )

  // Unique job (deduplication)
  await emailQueue.add(
    "send-digest",
    { count: 100, type: "weekly" },
    { unique: { key: "weekly-digest", action: "reject" } }
  )

  // ─── Data Processing Queue ───────────────────────────────────────────────

  // Long-running report with progress
  await dataQueue.add(
    "generate-report",
    { reportType: "quarterly-revenue", quarter: "Q2-2026" },
    { priority: 1, timeout: 60_000 }
  )

  // CSV import with high priority
  await dataQueue.add(
    "import-csv",
    { file: "users-export.csv", rows: 5000 },
    { priority: 0, timeout: 120_000 }
  )

  // Recurring cleanup (every 60 seconds)
  await dataQueue.add(
    "cleanup-old-data",
    { olderThan: "30d", tables: ["logs", "sessions"] },
    { cron: "*/60 * * * * *", maxAttempts: 5 }
  )

  // Recurring metrics aggregation (every 45 seconds)
  await dataQueue.add(
    "aggregate-metrics",
    { source: "application-events" },
    { cron: "*/45 * * * * *" }
  )

  // Jobs with dependencies (pipeline)
  const importJob = await dataQueue.add(
    "import-csv",
    { file: "products.csv", rows: 2000 },
    { priority: 1 }
  )
  await dataQueue.add(
    "generate-report",
    { reportType: "import-summary", sourceJob: importJob.id },
    { dependsOn: [importJob.id] }
  )

  // ─── Notification Queue ──────────────────────────────────────────────────

  // Burst of push notifications
  const platforms = ["ios", "android", "web"]
  for (let i = 0; i < 8; i++) {
    await notificationQueue.add(
      "push-notification",
      {
        userId: `user-${i + 1}`,
        platform: platforms[i % 3],
        message: "New feature available",
      },
      { priority: 2 }
    )
  }

  // Slack alerts with varying priority
  await notificationQueue.add(
    "slack-alert",
    {
      channel: "#alerts",
      message: "CPU usage above 90%",
      severity: "critical",
    },
    { priority: 0 }
  )
  await notificationQueue.add(
    "slack-alert",
    { channel: "#deployments", message: "Deploy v2.4.1 started" },
    { priority: 1 }
  )

  // Webhooks with retry
  await notificationQueue.add(
    "webhook",
    { url: "https://hooks.example.com/deploy", event: "deploy.started" },
    { maxAttempts: 5 }
  )
  await notificationQueue.add(
    "webhook",
    { url: "https://partner-api.com/notify", event: "order.completed" },
    { maxAttempts: 5, delay: 5000 }
  )

  // Recurring health-check webhook (every 20 seconds)
  await notificationQueue.add(
    "webhook",
    { url: "https://status.example.com/ping", event: "heartbeat" },
    { cron: "*/20 * * * * *", maxAttempts: 2 }
  )

  // ─── Flow: Onboarding Pipeline ───────────────────────────────────────────

  await emailQueue.addFlow({
    children: [
      {
        name: "send-welcome",
        payload: { to: "newuser@example.com", template: "onboarding-step1" },
      },
      {
        children: [
          {
            name: "push-notification",
            payload: {
              userId: "new-user",
              platform: "ios",
              message: "Setup your profile",
            },
          },
        ],
        name: "send-welcome",
        payload: { to: "newuser@example.com", template: "onboarding-step2" },
      },
    ],
    name: "send-digest",
    payload: { to: "newuser@example.com", type: "onboarding-complete" },
  })
}
