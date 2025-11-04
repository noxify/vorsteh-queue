import postgres from "postgres"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { QueueAdapter } from "@vorsteh-queue/core"

import type { SharedTestContext } from "../types"
import { initDatabase } from "../database"

export function runTests<TDatabase = unknown>(ctx: SharedTestContext<TDatabase>) {
  describe.each(ctx.testCases)(
    "Adapter Tests - $description",
    ({ modelName, schemaName, tableName, useDefault }) => {
      let database: Awaited<ReturnType<typeof initDatabase>>
      let db: ReturnType<SharedTestContext<TDatabase>["initDbClient"]>
      let adapter: QueueAdapter

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
        if (useDefault === false) {
          await internalDbClient`drop table if exists ${internalDbClient(schemaName)}.${internalDbClient(tableName)};`
        } else {
          await internalDbClient`drop table if exists queue_jobs;`
        }

        await ctx.migrate(db)
      }, 60000)

      afterAll(async () => {
        await adapter.disconnect()
        await database.container.stop()
      })

      beforeEach(async () => {
        if (useDefault === false) {
          await internalDbClient`DELETE FROM ${internalDbClient(schemaName)}.${internalDbClient(tableName)};`
        } else {
          await internalDbClient`DELETE FROM queue_jobs`
        }

        adapter = await ctx.initAdapter(
          db,
          useDefault === false ? { modelName, tableName, schemaName } : {},
        )

        await adapter.connect()
        adapter.setQueueName("test-queue")
      })

      describe("batch operations", () => {
        it("should add multiple jobs with addJobs", async () => {
          const jobs = await adapter.addJobs([
            {
              name: "batch-job-1",
              payload: { n: 1 },
              status: "pending",
              priority: 1,
              attempts: 0,
              maxAttempts: 2,
            },
            {
              name: "batch-job-2",
              payload: { n: 2 },
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 2,
            },
          ])
          expect(jobs).toHaveLength(2)
          if (jobs.length >= 2) {
            const [job0, job1] = jobs
            expect(job0).toBeDefined()
            expect(job1).toBeDefined()
            if (job0 && job1) {
              expect(job0.id).toBeDefined()
              expect(job1.id).toBeDefined()
              expect(job0.name).toBe("batch-job-1")
              expect(job1.name).toBe("batch-job-2")
            }
          }
        })

        it("should get next jobs for handler (batch)", async () => {
          await adapter.addJobs([
            {
              name: "batch-handler",
              payload: { n: 1 },
              status: "pending",
              priority: 1,
              attempts: 0,
              maxAttempts: 2,
            },
            {
              name: "batch-handler",
              payload: { n: 2 },
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 2,
            },
            {
              name: "other-handler",
              payload: { n: 3 },
              status: "pending",
              priority: 3,
              attempts: 0,
              maxAttempts: 2,
            },
          ])
          const jobs = await adapter.getNextJobsForHandler("batch-handler", 5)
          expect(jobs).toHaveLength(2)
          if (jobs.length >= 2) {
            const [job0, job1] = jobs
            expect(job0).toBeDefined()
            expect(job1).toBeDefined()
            if (job0 && job1) {
              expect(job0.name).toBe("batch-handler")
              expect(job1.name).toBe("batch-handler")
              // Should be sorted by priority
              expect(job0.priority).toBeLessThanOrEqual(job1.priority)
            }
          }
        })

        it("should respect batch size limit", async () => {
          await adapter.addJobs([
            {
              name: "batch",
              payload: { n: 1 },
              status: "pending",
              priority: 1,
              attempts: 0,
              maxAttempts: 2,
            },
            {
              name: "batch",
              payload: { n: 2 },
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 2,
            },
            {
              name: "batch",
              payload: { n: 3 },
              status: "pending",
              priority: 3,
              attempts: 0,
              maxAttempts: 2,
            },
          ])
          const jobs = await adapter.getNextJobsForHandler("batch", 2)
          expect(jobs).toHaveLength(2)
        })

        it("should isolate jobs by handler name", async () => {
          await adapter.addJobs([
            {
              name: "handler-a",
              payload: {},
              status: "pending",
              priority: 1,
              attempts: 0,
              maxAttempts: 2,
            },
            {
              name: "handler-b",
              payload: {},
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 2,
            },
          ])
          const jobsA = await adapter.getNextJobsForHandler("handler-a", 5)
          const jobsB = await adapter.getNextJobsForHandler("handler-b", 5)
          expect(jobsA.every((j) => j.name === "handler-a")).toBe(true)
          expect(jobsB.every((j) => j.name === "handler-b")).toBe(true)
        })

        it("should return empty array if no jobs for handler", async () => {
          const jobs = await adapter.getNextJobsForHandler("nonexistent-handler", 3)
          expect(jobs).toEqual([])
        })
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

          const [updated]: [{ processed_at: Date; status: string }?] =
            useDefault === false
              ? await internalDbClient`SELECT processed_at, status FROM ${internalDbClient(schemaName)}.${internalDbClient(tableName)} WHERE id=${job.id}`
              : await internalDbClient`SELECT processed_at, status FROM queue_jobs WHERE id=${job.id}`

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

          const [updated]: [{ completed_at: Date; status: string; result: unknown }?] =
            useDefault === false
              ? await internalDbClient`SELECT completed_at, status, result FROM ${internalDbClient(schemaName)}.${internalDbClient(tableName)} WHERE id=${job.id}`
              : await internalDbClient`SELECT completed_at, status, result FROM queue_jobs WHERE id=${job.id}`

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

          const tableNameWithSchema =
            useDefault === false ? `${schemaName}.${tableName}` : "queue_jobs"

          const [updated]: [{ result: unknown }?] =
            await internalDbClient`SELECT result FROM ${internalDbClient(tableNameWithSchema)} WHERE id=${job.id}`

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
            useDefault === false
              ? await internalDbClient`SELECT result FROM ${internalDbClient(schemaName)}.${internalDbClient(tableName)} WHERE id=${job.id}`
              : await internalDbClient`SELECT result FROM queue_jobs WHERE id=${job.id}`

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
            useDefault === false
              ? await internalDbClient`SELECT result, status FROM ${internalDbClient(schemaName)}.${internalDbClient(tableName)} WHERE id=${job.id}`
              : await internalDbClient`SELECT result, status FROM queue_jobs WHERE id=${job.id}`

          expect(updated?.result).toEqual(result)
          expect(updated?.status).toBe("completed")
        })
      })
    },
  )
}
