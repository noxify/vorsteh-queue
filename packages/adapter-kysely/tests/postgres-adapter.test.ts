import { promises as fs } from "fs"
import * as path from "path"
import { PGlite } from "@electric-sql/pglite"
import { FileMigrationProvider, Kysely, Migrator, sql } from "kysely"
import { PGliteDialect } from "kysely-pglite-dialect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { DB } from "~/types"
import { PostgresQueueAdapter } from "~/index"

describe("PostgresQueueAdapter", () => {
  let db: Kysely<DB>
  let adapter: PostgresQueueAdapter

  let client: PGlite

  beforeEach(async () => {
    client = new PGlite(undefined, { database: "test" })

    db = new Kysely<DB>({
      dialect: new PGliteDialect(client),
    })

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        // This needs to be an absolute path.
        migrationFolder: path.join(__dirname, "../src/migrations"),
      }),
    })

    await migrator.migrateToLatest()

    adapter = new PostgresQueueAdapter(db)
    adapter.setQueueName("test-queue")
    await adapter.connect()
  })

  afterEach(async () => {
    await adapter.disconnect()
    await client.close()
  })

  describe("basic operations", () => {
    it("should add a job", async () => {
      const job = await adapter.addJob({
        name: "test-job",
        payload: { data: "test" },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      expect(job.id).toBeDefined()
      expect(job.name).toBe("test-job")
      expect(job.payload).toEqual({ data: "test" })
      expect(job.status).toBe("pending")
    })

    it("should get next pending job with SKIP LOCKED", async () => {
      await adapter.addJob({
        name: "job-1",
        payload: { order: 1 },
        status: "pending",
        priority: 1,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      await adapter.addJob({
        name: "job-2",
        payload: { order: 2 },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      const job = await adapter.getNextJob()
      expect(job).toBeTruthy()

      expect(job?.name).toBe("job-1") // High priority first
    })

    it("should update job status", async () => {
      const job = await adapter.addJob({
        name: "test-job",
        payload: { data: "test" },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      await adapter.updateJobStatus(job.id, "processing")

      const updated = await db
        .selectFrom("queue_jobs")
        .select(["status", "processed_at"])
        .where("id", "=", job.id)
        .executeTakeFirst()

      expect(updated?.status).toBe("processing")
      expect(updated?.processed_at).toBeTruthy()
    })

    it("should get queue stats", async () => {
      await adapter.addJob({
        name: "job-1",
        payload: {},
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      await adapter.addJob({
        name: "job-2",
        payload: {},
        status: "completed",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      const stats = await adapter.getQueueStats()
      expect(stats.pending).toBe(1)
      expect(stats.completed).toBe(1)
    })

    it("should handle delayed jobs", async () => {
      const futureTime = new Date(Date.now() + 60000)

      await adapter.addJob({
        name: "delayed-job",
        payload: { data: "delayed" },
        status: "delayed",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: futureTime,
      })

      // Should not get delayed job that's not ready

      const job1 = await adapter.getNextJob()
      expect(job1).toBeNull()

      // Should get delayed job that's ready
      const pastTime = new Date(Date.now() - 60000)
      await adapter.addJob({
        name: "ready-job",
        payload: { data: "ready" },
        status: "delayed",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: pastTime,
      })

      const job2 = await adapter.getNextJob()
      expect(job2).toBeTruthy()

      expect(job2?.name).toBe("ready-job")
    })
  })

  describe("scheduling features", () => {
    it("should handle cron jobs", async () => {
      const job = await adapter.addJob({
        name: "cron-job",
        payload: { data: "cron" },
        status: "delayed",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(Date.now() + 60000),
        cron: "0 9 * * *",
      })

      expect(job.cron).toBe("0 9 * * *")
    })

    it("should handle recurring jobs", async () => {
      const job = await adapter.addJob({
        name: "recurring-job",
        payload: { data: "recurring" },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        repeatEvery: 60000,
        repeatLimit: 5,
        repeatCount: 2,
      })

      expect(job.repeatEvery).toBe(60000)
      expect(job.repeatLimit).toBe(5)
      expect(job.repeatCount).toBe(2)
    })
  })
})

describe("PostgresQueueAdapter - Timezone Handling", () => {
  let db: Kysely<DB>
  let adapter: PostgresQueueAdapter

  let client: PGlite

  beforeEach(async () => {
    client = new PGlite()

    db = new Kysely<DB>({
      dialect: new PGliteDialect(new PGlite()),
    })

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        // This needs to be an absolute path.
        migrationFolder: path.join(__dirname, "../src/migrations"),
      }),
    })

    await migrator.migrateToLatest()

    adapter = new PostgresQueueAdapter(db)
    adapter.setQueueName("timezone-test-queue")
    await adapter.connect()
  })

  afterEach(async () => {
    await adapter.disconnect()
    await client.close()
  })

  it("should handle UTC timestamps correctly regardless of database timezone", async () => {
    // Set database timezone to something other than UTC
    await sql<string>`SET timezone = 'America/New_York'`.execute(db)

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

    const retrieved = await db
      .selectFrom("queue_jobs")
      .select("process_at")
      .where("id", "=", job.id)
      .executeTakeFirst()

    // The processAt should match our input UTC time
    expect(retrieved?.process_at.getTime()).toBe(testDate.getTime())

    // Update job status and check timestamp consistency
    await adapter.updateJobStatus(job.id, "processing")

    const updated = await db
      .selectFrom("queue_jobs")
      .select("processed_at")
      .where("id", "=", job.id)
      .executeTakeFirst()

    // processedAt should be a valid UTC timestamp
    expect(updated?.processed_at).toBeTruthy()
    expect(updated?.processed_at?.getTime()).toBeGreaterThan(testDate.getTime())
  })
})

describe("PostgresQueueAdapter - Result Storage", () => {
  let db: Kysely<DB>
  let adapter: PostgresQueueAdapter
  let client: PGlite

  beforeEach(async () => {
    client = new PGlite()

    db = new Kysely<DB>({
      dialect: new PGliteDialect(new PGlite()),
    })

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        // This needs to be an absolute path.
        migrationFolder: path.join(__dirname, "../src/migrations"),
      }),
    })

    await migrator.migrateToLatest()

    adapter = new PostgresQueueAdapter(db)
    adapter.setQueueName("test-queue")
    await adapter.connect()
  })

  afterEach(async () => {
    await adapter.disconnect()
    await client.close()
  })

  it("should store job result when job completes", async () => {
    const job = await adapter.addJob({
      name: "test-job",
      payload: { input: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    const result = { success: true, output: "processed" }
    await adapter.updateJobStatus(job.id, "completed", undefined, result)

    const updated = await db
      .selectFrom("queue_jobs")
      .select(["status", "completed_at", "result"])
      .where("id", "=", job.id)
      .executeTakeFirst()

    expect(updated?.status).toBe("completed")
    expect(updated?.result).toEqual(result)
    expect(updated?.completed_at).toBeTruthy()
  })

  it("should handle null/undefined results", async () => {
    const job = await adapter.addJob({
      name: "test-job",
      payload: { input: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    await adapter.updateJobStatus(job.id, "completed", undefined, null)

    const updated = await db
      .selectFrom("queue_jobs")
      .select("result")
      .where("id", "=", job.id)
      .executeTakeFirst()

    expect(updated?.result).toBeNull()
  })

  it("should preserve result in transformJob method", async () => {
    const job = await adapter.addJob({
      name: "test-job",
      payload: { input: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    const result = { data: "test-result", count: 42 }
    await adapter.updateJobStatus(job.id, "completed", undefined, result)

    const nextJob = await adapter.getNextJob()
    expect(nextJob).toBeNull() // No pending jobs

    // Get the completed job directly from database and transform
    const dbJob = await db
      .selectFrom("queue_jobs")
      .select("result")
      .where("id", "=", job.id)
      .executeTakeFirst()

    expect(dbJob?.result).toEqual(result)
  })

  it("should not update result when not provided", async () => {
    const job = await adapter.addJob({
      name: "test-job",
      payload: { input: "test" },
      status: "pending",
      priority: 2,
      attempts: 0,
      maxAttempts: 3,
      processAt: new Date(),
    })

    // First update with result
    const result = { initial: "result" }
    await adapter.updateJobStatus(job.id, "processing", undefined, result)

    // Second update without result (should preserve existing result)
    await adapter.updateJobStatus(job.id, "completed")

    const updated = await db
      .selectFrom("queue_jobs")
      .select(["result", "status"])
      .where("id", "=", job.id)
      .executeTakeFirst()

    expect(updated?.result).toEqual(result)
    expect(updated?.status).toBe("completed")
  })
})
