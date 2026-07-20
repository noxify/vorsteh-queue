import type { StepContext } from "@vorsteh-queue/core"
import { Worker } from "@vorsteh-queue/core"

import { createAdapter } from "./queues"

// ─── Email Worker ────────────────────────────────────────────────────────────

export const emailWorker = new Worker(createAdapter(), {
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

export const dataWorker = new Worker(createAdapter(), {
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

export const notificationWorker = new Worker(createAdapter(), {
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
// ─── Deployment Worker (Step-based Workflows) ───────────────────────────────

export const deployWorker = new Worker(createAdapter(), {
  concurrency: 1,
  name: "deployments",
  pollInterval: 500,
})

deployWorker.register("deploy-nested", async (job, { step }) => {
  const payload = job.payload as { version: string; environment: string }

  const buildResult = await step.run("build-artifacts", async () => {
    await delay(randomBetween(1500, 3000))
    return { artifact: `build-${payload.version}.tar.gz`, size: "42MB" }
  })

  await step.run("run-tests", async () => {
    await delay(randomBetween(2000, 4000))
    if (Math.random() < 0.1) {
      throw new Error("Integration test failed: timeout on DB connection")
    }
    return { passed: 47, failed: 0, skipped: 2 }
  })

  await step.sleep("cooldown", "5s")

  await step.run("deploy-to-staging", async () => {
    await delay(randomBetween(1000, 2000))
    return { host: `staging-${payload.environment}.example.com`, healthy: true }
  })

  const approval = await step.waitFor<{ approver: string }>(
    "approval-gate",
    `deploy-approved:${payload.version}`,
    { timeout: "30s" }
  )

  await step.run("deploy-to-production", async () => {
    await delay(randomBetween(2000, 5000))
    return {
      approvedBy: approval.approver,
      artifact: buildResult.artifact,
      host: `prod-${payload.environment}.example.com`,
    }
  })

  return {
    deployed: true,
    environment: payload.environment,
    version: payload.version,
  }
})

deployWorker.register("deploy-simple", async (job, { step }) => {
  const payload = job.payload as { version: string; environment: string }

  await step.run("build-artifacts", async () => {
    await delay(randomBetween(1500, 3000))
    return { artifact: `build-${payload.version}.tar.gz`, size: "42MB" }
  })

  await step.run("run-tests", async () => {
    await delay(randomBetween(2000, 4000))
    return { passed: 47, failed: 0, skipped: 2 }
  })

  await step.run("deploy-to-production", async () => {
    await delay(randomBetween(2000, 5000))
    return { host: `prod-${payload.environment}.example.com` }
  })

  return {
    deployed: true,
    environment: payload.environment,
    version: payload.version,
  }
})

deployWorker.register("build", async (_job, { step }) => {
  await step.run("install-deps", async () => {
    await delay(randomBetween(800, 1500))
    return { packages: 142 }
  })

  await step.run("compile", async () => {
    await delay(randomBetween(1000, 2500))
    return { files: 87, outputSize: "12MB" }
  })

  await step.run("upload-artifact", async () => {
    await delay(randomBetween(500, 1000))
    return { bucket: "s3://artifacts", key: `build-${Date.now()}.tar.gz` }
  })

  return { success: true }
})

deployWorker.register("run-integration-tests", async (_job, { step }) => {
  const unit = await step.run("unit-tests", async () => {
    await delay(randomBetween(1000, 2000))
    return { passed: 234, failed: 0 }
  })

  const integration = await step.run("integration-tests", async () => {
    await delay(randomBetween(2000, 4000))
    if (Math.random() < 0.2) {
      throw new Error("Flaky test: API timeout")
    }
    return { passed: 45, failed: 0 }
  })

  await step.run("e2e-tests", async () => {
    await delay(randomBetween(3000, 6000))
    return { passed: 12, failed: 0 }
  })

  return { total: unit.passed + integration.passed + 12, allPassed: true }
})

deployWorker.register(
  "provision-infra",
  async (job, { step }: { step: StepContext }) => {
    const payload = job.payload as { environment: string; region: string }

    await step.run("create-vpc", async () => {
      await delay(randomBetween(1000, 2000))
      return { vpcId: `vpc-${Date.now()}` }
    })

    await step.run("create-cluster", async () => {
      await delay(randomBetween(2000, 4000))
      return { clusterId: `cluster-${payload.region}-${Date.now()}` }
    })

    await step.sleep("wait-for-cluster-ready", "8s")

    await step.run("configure-networking", async () => {
      await delay(randomBetween(500, 1500))
      return { loadBalancer: `lb-${payload.environment}.example.com` }
    })

    return {
      environment: payload.environment,
      ready: true,
      region: payload.region,
    }
  }
)

deployWorker.register("notify-deploy", async () => {
  await delay(randomBetween(300, 800))
  return { notified: ["#deployments", "#engineering"], ts: Date.now() }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
