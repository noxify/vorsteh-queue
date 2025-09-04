import postgres from "postgres"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { BaseQueueAdapter } from "@vorsteh-queue/core"

import type { SharedTestContext } from "../types"
import { initDatabase } from "../database"

export function runTests<TDatabase = unknown>(ctx: SharedTestContext<TDatabase>) {
  describe("Adapter Tests", () => {
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

        const [updated]: [{ progressed_at: number; status: string }?] =
          await internalDbClient`SELECT processed_at, status FROM queue_jobs WHERE id=${job.id}`

        expect(updated?.status).toBe("processing")
        expect(updated?.progressed_at).toBeTruthy()
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

    describe("Result storage", () => {
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

        const [updated]: [{ completed_at: number; status: string; result: unknown }?] =
          await internalDbClient`SELECT completed_at, status, result FROM queue_jobs WHERE id=${job.id}`

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

        const [updated]: [{ result: unknown }?] =
          await internalDbClient`SELECT result FROM queue_jobs WHERE id=${job.id}`

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

        const [dbJob]: [{ result: unknown }?] =
          await internalDbClient`SELECT result FROM queue_jobs WHERE id=${job.id}`

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

        const [updated]: [{ result: unknown; status: string }?] =
          await internalDbClient`SELECT result FROM queue_jobs WHERE id=${job.id}`

        expect(updated?.result).toEqual(result)
        expect(updated?.status).toBe("completed")
      })
    })
  })
}
