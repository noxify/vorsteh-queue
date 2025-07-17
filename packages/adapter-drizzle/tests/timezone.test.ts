import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { DrizzleQueueAdapter } from "../src"
import * as schema from "../src/schema"

// Import pushSchema from drizzle-kit/api
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
const { pushSchema } = require("drizzle-kit/api") as typeof import("drizzle-kit/api")

describe("DrizzleQueueAdapter Timezone Support", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let adapter: DrizzleQueueAdapter
  let client: PGlite

  beforeEach(async () => {
    client = new PGlite()
    db = drizzle(client, { schema })

    // Apply schema using drizzle-kit/api
    const { apply } = await pushSchema(schema, db as never)
    await apply()

    adapter = new DrizzleQueueAdapter(db, "test-queue")
    await adapter.connect()
  })

  afterEach(async () => {
    await adapter.disconnect()
    await client.close()
  })

  it("should store timezone information with jobs", async () => {
    const job = await adapter.addJob({
      name: "timezone-job",
      payload: { data: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
      timezone: "America/New_York",
    })

    expect(job.timezone).toBe("America/New_York")
  })

  it("should default to UTC timezone", async () => {
    const job = await adapter.addJob({
      name: "default-timezone-job",
      payload: { data: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    expect(job.timezone).toBe("UTC")
  })

  it("should store timestamps as UTC in database", async () => {
    const processAt = new Date("2024-01-15T14:00:00Z") // 2 PM UTC

    const job = await adapter.addJob({
      name: "utc-timestamp-job",
      payload: { data: "test" },
      status: "delayed",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt,
      timezone: "America/New_York",
    })

    // Verify the stored processAt is the same UTC time
    expect(job.processAt.getTime()).toBe(processAt.getTime())
    expect(job.processAt.toISOString()).toBe("2024-01-15T14:00:00.000Z")
  })

  it("should handle cron jobs with timezone", async () => {
    const job = await adapter.addJob({
      name: "cron-timezone-job",
      payload: { data: "test" },
      status: "delayed",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(Date.now() + 60000),
      cron: "0 9 * * *",
      timezone: "Europe/London",
    })

    expect(job.cron).toBe("0 9 * * *")
    expect(job.timezone).toBe("Europe/London")
  })

  it("should handle recurring jobs with timezone", async () => {
    const job = await adapter.addJob({
      name: "recurring-timezone-job",
      payload: { data: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
      repeatEvery: 3600000, // 1 hour
      repeatLimit: 10,
      repeatCount: 0,
      timezone: "Asia/Tokyo",
    })

    expect(job.repeatEvery).toBe(3600000)
    expect(job.repeatLimit).toBe(10)
    expect(job.timezone).toBe("Asia/Tokyo")
  })

  it("should retrieve jobs with timezone information", async () => {
    // Add a job with timezone
    await adapter.addJob({
      name: "retrieve-timezone-job",
      payload: { data: "test" },
      status: "pending",
      priority: 1,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
      timezone: "Australia/Sydney",
    })

    // Retrieve the job
    const job = await adapter.getNextJob()
    expect(job).toBeTruthy()
    expect(job?.timezone).toBe("Australia/Sydney")
  })

  it("should handle multiple jobs with different timezones", async () => {
    const timezones = ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"]
    const jobs = []

    // Add jobs with different timezones
    for (const timezone of timezones) {
      const job = await adapter.addJob({
        name: `job-${timezone.replace("/", "-")}`,
        payload: { timezone },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        timezone,
      })
      jobs.push(job)
    }

    // Verify all jobs have correct timezones
    for (let i = 0; i < jobs.length; i++) {
      expect(jobs[i]?.timezone).toBe(timezones[i])
    }

    // Verify queue stats
    const stats = await adapter.getQueueStats()
    expect(stats.pending).toBe(4)
  })
})
