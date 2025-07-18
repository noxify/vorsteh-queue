import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { DrizzleQueueAdapter } from "~/index"
import * as schema from "~/schema"

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
const { pushSchema } = require("drizzle-kit/api") as typeof import("drizzle-kit/api")

describe("Timezone Edge Cases", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let adapter: DrizzleQueueAdapter
  let client: PGlite

  beforeEach(async () => {
    client = new PGlite()
    db = drizzle(client, { schema })

    const { apply } = await pushSchema(schema, db as never)
    await apply()

    adapter = new DrizzleQueueAdapter(db, "timezone-edge-test")
    await adapter.connect()
  })

  afterEach(async () => {
    await adapter.disconnect()
    await client.close()
  })

  it("should handle dates with explicit timezone offsets", async () => {
    // User passes date with timezone offset
    const dateWithOffset = new Date("2024-01-15T14:00:00+02:00") // 2 PM in +2 timezone = 12 PM UTC

    const job = await adapter.addJob({
      name: "offset-test",
      payload: { test: "data" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: dateWithOffset,
      progress: 0,
      repeatCount: 0,
    })

    // Should store the UTC equivalent (12 PM UTC, not 2 PM UTC)
    expect(job.processAt.toISOString()).toBe("2024-01-15T12:00:00.000Z")
    expect(job.processAt.getTime()).toBe(dateWithOffset.getTime())
  })

  it("should handle negative timezone offsets", async () => {
    // User passes date with negative timezone offset
    const dateWithNegativeOffset = new Date("2024-01-15T14:00:00-05:00") // 2 PM EST = 7 PM UTC

    const job = await adapter.addJob({
      name: "negative-offset-test",
      payload: { test: "data" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: dateWithNegativeOffset,
      progress: 0,
      repeatCount: 0,
    })

    // Should store the UTC equivalent (7 PM UTC)
    expect(job.processAt.toISOString()).toBe("2024-01-15T19:00:00.000Z")
    expect(job.processAt.getTime()).toBe(dateWithNegativeOffset.getTime())
  })

  it("should handle server in different timezone", async () => {
    // Simulate server running in different timezone by creating dates in different ways
    const utcDate = new Date("2024-01-15T14:00:00Z") // Explicit UTC
    const localDate = new Date("2024-01-15T14:00:00") // Local time (depends on server timezone)

    const utcJob = await adapter.addJob({
      name: "utc-job",
      payload: { type: "utc" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: utcDate,
      progress: 0,
      repeatCount: 0,
    })

    const localJob = await adapter.addJob({
      name: "local-job",
      payload: { type: "local" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: localDate,
      progress: 0,
      repeatCount: 0,
    })

    // UTC date should be stored exactly as provided
    expect(utcJob.processAt.toISOString()).toBe("2024-01-15T14:00:00.000Z")

    // Local date gets stored as whatever the server interprets it as
    // This is the key test - we store whatever Date object represents in UTC
    expect(localJob.processAt).toBeInstanceOf(Date)
    expect(localJob.processAt.getTime()).toBe(localDate.getTime())
  })

  it("should handle daylight saving time transitions", async () => {
    // Spring forward: March 10, 2024 in America/New_York
    const springForwardDate = new Date("2024-03-10T07:00:00Z") // 2 AM EST becomes 3 AM EDT

    // Fall back: November 3, 2024 in America/New_York
    const fallBackDate = new Date("2024-11-03T06:00:00Z") // 2 AM EDT becomes 1 AM EST

    const springJob = await adapter.addJob({
      name: "spring-job",
      payload: { dst: "spring" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: springForwardDate,
      progress: 0,
      repeatCount: 0,
    })

    const fallJob = await adapter.addJob({
      name: "fall-job",
      payload: { dst: "fall" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: fallBackDate,
      progress: 0,
      repeatCount: 0,
    })

    // Both should store exact UTC timestamps regardless of DST
    expect(springJob.processAt.toISOString()).toBe("2024-03-10T07:00:00.000Z")
    expect(fallJob.processAt.toISOString()).toBe("2024-11-03T06:00:00.000Z")
  })

  it("should handle various date formats consistently", async () => {
    const testCases = [
      {
        name: "ISO with Z",
        date: new Date("2024-01-15T14:00:00Z"),
        expected: "2024-01-15T14:00:00.000Z",
      },
      {
        name: "ISO with +00:00",
        date: new Date("2024-01-15T14:00:00+00:00"),
        expected: "2024-01-15T14:00:00.000Z",
      },
      {
        name: "ISO with +02:00",
        date: new Date("2024-01-15T14:00:00+02:00"),
        expected: "2024-01-15T12:00:00.000Z", // 2 hours earlier in UTC
      },
      {
        name: "ISO with -05:00",
        date: new Date("2024-01-15T14:00:00-05:00"),
        expected: "2024-01-15T19:00:00.000Z", // 5 hours later in UTC
      },
      {
        name: "Timestamp",
        date: new Date(1705327200000), // 2024-01-15T14:00:00Z
        expected: "2024-01-15T14:00:00.000Z",
      },
    ]

    for (const testCase of testCases) {
      const job = await adapter.addJob({
        name: `format-test-${testCase.name}`,
        payload: { format: testCase.name },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: testCase.date,
        progress: 0,
        repeatCount: 0,
      })

      expect(job.processAt.toISOString()).toBe(testCase.expected)
    }
  })

  it("should maintain timestamp consistency across retrieval", async () => {
    // Test that what goes in comes out exactly the same
    const originalTimestamp = 1705327200000 // 2024-01-15T14:00:00Z
    const originalDate = new Date(originalTimestamp)

    const job = await adapter.addJob({
      name: "consistency-test",
      payload: { test: "data" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: originalDate,
      progress: 0,
      repeatCount: 0,
    })

    // Retrieve the job
    const retrievedJob = await adapter.getNextJob()

    expect(retrievedJob).toBeTruthy()
    expect(retrievedJob?.processAt.getTime()).toBe(originalTimestamp)
    expect(retrievedJob?.processAt.toISOString()).toBe(originalDate.toISOString())
  })
})
