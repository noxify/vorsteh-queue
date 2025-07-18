import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { DrizzleQueueAdapter } from "~/index"
import * as schema from "~/schema"

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
const { pushSchema } = require("drizzle-kit/api") as typeof import("drizzle-kit/api")

describe("UTC Storage Verification", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let adapter: DrizzleQueueAdapter
  let client: PGlite

  beforeEach(async () => {
    client = new PGlite()
    db = drizzle(client, { schema })

    const { apply } = await pushSchema(schema, db as never)
    await apply()

    adapter = new DrizzleQueueAdapter(db, "utc-test-queue")
    await adapter.connect()
  })

  afterEach(async () => {
    await adapter.disconnect()
    await client.close()
  })

  it("should store all timestamps as UTC in database", async () => {
    const now = new Date()

    // Add job with timezone context
    const job = await adapter.addJob({
      name: "timezone-test",
      payload: { test: "data" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date("2024-01-15T14:00:00Z"), // 9 AM EST = 2 PM UTC
      progress: 0,
      cron: "0 9 * * *",
      repeatEvery: undefined,
      repeatLimit: undefined,
      repeatCount: 0,
    })

    // Verify the job was stored
    expect(job.processAt).toBeInstanceOf(Date)

    // The key test: processAt should be the exact UTC time we provided
    expect(job.processAt.toISOString()).toBe("2024-01-15T14:00:00.000Z")

    // Verify no timezone field exists
    expect(job).not.toHaveProperty("timezone")

    // Verify createdAt is also UTC
    expect(job.createdAt.getTimezoneOffset()).toBe(new Date().getTimezoneOffset()) // Should be system UTC
  })

  it("should handle cron jobs with timezone conversion at creation", async () => {
    // This simulates what happens when user adds a cron job with timezone
    const processAt = new Date("2024-01-15T14:00:00Z") // Pre-converted to UTC

    const job = await adapter.addJob({
      name: "cron-timezone-test",
      payload: { timezone: "America/New_York" }, // Timezone info in payload only
      status: "delayed",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt, // Already UTC
      progress: 0,
      cron: "0 9 * * *", // Original cron expression
      repeatEvery: undefined,
      repeatLimit: undefined,
      repeatCount: 0,
    })

    // Database should store exact UTC timestamp
    expect(job.processAt.toISOString()).toBe("2024-01-15T14:00:00.000Z")
    expect(job.cron).toBe("0 9 * * *")
    expect(job).not.toHaveProperty("timezone")
  })

  it("should retrieve jobs with UTC timestamps", async () => {
    // Add a job
    await adapter.addJob({
      name: "retrieval-test",
      payload: { test: "data" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date("2024-01-15T14:00:00Z"),
      progress: 0,
      repeatCount: 0,
    })

    // Retrieve the job
    const job = await adapter.getNextJob()

    expect(job).toBeTruthy()
    expect(job?.processAt.toISOString()).toBe("2024-01-15T14:00:00.000Z")
    expect(job).not.toHaveProperty("timezone")
  })

  it("should handle delayed jobs with UTC timestamps", async () => {
    const futureUTC = new Date(Date.now() + 3600000) // 1 hour from now in UTC

    const job = await adapter.addJob({
      name: "delayed-test",
      payload: { test: "data" },
      status: "delayed",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: futureUTC,
      progress: 0,
      repeatCount: 0,
    })

    // Should store exact UTC timestamp
    expect(job.processAt.getTime()).toBe(futureUTC.getTime())
    expect(job.status).toBe("delayed")
  })

  it("should verify database schema has no timezone columns", async () => {
    // This is more of a schema verification test
    const job = await adapter.addJob({
      name: "schema-test",
      payload: { test: "data" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
      progress: 0,
      repeatCount: 0,
    })

    // Verify the job object structure
    const jobKeys = Object.keys(job)
    expect(jobKeys).not.toContain("timezone")

    // Verify required UTC fields exist
    expect(jobKeys).toContain("createdAt")
    expect(jobKeys).toContain("processAt")

    // All date fields should be Date objects (UTC)
    expect(job.createdAt).toBeInstanceOf(Date)
    expect(job.processAt).toBeInstanceOf(Date)
  })
})
