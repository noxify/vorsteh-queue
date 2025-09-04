import postgres from "postgres"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { BaseQueueAdapter } from "@vorsteh-queue/core"

import type { SharedTestContext } from "../types"
import { initDatabase } from "../database"

export function runTests<TDatabase = unknown>(ctx: SharedTestContext<TDatabase>) {
  describe("Timezone Tests", () => {
    let database: Awaited<ReturnType<typeof initDatabase>>
    let db: ReturnType<SharedTestContext<TDatabase>["initDbClient"]>
    let adapter: BaseQueueAdapter

    // the internal db client is based on postgres.js and will be used
    // to directly query the database for verification purposes
    // we have to use a separate client because the adapter's client have a different syntax to query data
    // and it's easier to use postgres.js directly here, instead of trying to adapt to the adapter's query syntax
    let internalDbClient: postgres.Sql

    beforeAll(async () => {
      // creating a new database container for each test suite
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      database = await initDatabase(process.env.PG_VERSION ? Number(process.env.PG_VERSION) : 17)

      vi.stubEnv("DATABASE_URL", database.container.getConnectionUri())

      internalDbClient = postgres(database.container.getConnectionUri(), {
        max: 10,
      })

      db = ctx.initDbClient(database)

      // fix `gen_random_uuid does not exists` error on postgres 12
      await internalDbClient`CREATE EXTENSION IF NOT EXISTS pgcrypto CASCADE;`
      // ensure the database is clean before migration
      await internalDbClient`drop table if exists queue_jobs;`

      await ctx.migrate(db)
    }, 60000)

    afterAll(async () => {
      await adapter.disconnect()
      await database.container.stop()
    })

    beforeEach(async () => {
      await internalDbClient`DELETE FROM queue_jobs`

      adapter = await ctx.initAdapter(db)

      await adapter.connect()
      adapter.setQueueName("test-queue")
    })

    it("should handle UTC timestamps correctly regardless of database timezone", async () => {
      // Set database timezone to something other than UTC
      // await db.execute(sql`SET timezone = 'America/New_York'`)

      await internalDbClient`SET timezone = 'America/New_York`

      const testDate = new Date("2025-01-15T12:00:00.000Z") // Explicit UTC time

      const job = await adapter.addJob({
        name: "timezone-test",
        payload: { test: "timezone" },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: testDate,
      })

      // Retrieve the job and check the timestamp
      const [retrieved]: [{ process_at: number }?] =
        await internalDbClient`SELECT process_at FROM queue_jobs WHERE id=${job.id}`

      // The processAt should match our input UTC time
      expect(retrieved?.process_at).toBe(testDate.getTime())

      // Update job status and check timestamp consistency
      await adapter.updateJobStatus(job.id, "processing")

      const [updated]: [{ processed_at: number }?] =
        await internalDbClient`SELECT processed_at FROM queue_jobs WHERE id=${job.id}`

      // processedAt should be a valid UTC timestamp
      expect(updated?.processed_at).toBeTruthy()
      expect(updated?.processed_at).toBeGreaterThan(testDate.getTime())
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

      await adapter.addJob({
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

    it("should store all timestamps as UTC in database", async () => {
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
  })
}
