import type { QueueAdapter } from "@vorsteh-queue/core"
import postgres from "postgres"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { initDatabase } from "../database"
import type { SharedTestContext } from "../types"

export function runTests<TDatabase = unknown>(
  ctx: SharedTestContext<TDatabase>
) {
  describe.each(ctx.testCases)(
    "Adapter Tests - $description",
    ({ modelName, schemaName, tableName, useDefault }) => {
      let database: Awaited<ReturnType<typeof initDatabase>>
      let db: ReturnType<SharedTestContext<TDatabase>["initDbClient"]>
      let adapter: QueueAdapter
      let internalDbClient: postgres.Sql

      beforeAll(async () => {
        database = await initDatabase(
          // eslint-disable-next-line no-restricted-properties
          process.env.PG_VERSION ? Number(process.env.PG_VERSION) : 17
        )

        // eslint-disable-next-line no-restricted-properties
        vi.stubEnv("DATABASE_URL", database.container.getConnectionUri())

        internalDbClient = postgres(database.container.getConnectionUri(), {
          max: 10,
        })
        db = ctx.initDbClient(database)

        await internalDbClient`CREATE EXTENSION IF NOT EXISTS pgcrypto CASCADE;`

        // eslint-disable-next-line unicorn/prefer-ternary
        if (useDefault === false) {
          await internalDbClient`drop table if exists ${internalDbClient(schemaName)}.${internalDbClient(tableName)};`
        } else {
          await internalDbClient`drop table if exists queue_jobs;`
        }

        await ctx.migrate(db)
      }, 60_000)

      afterAll(async () => {
        await adapter.disconnect()
        await database.container.stop()
      })

      beforeEach(async () => {
        // eslint-disable-next-line unicorn/prefer-ternary
        if (useDefault === false) {
          await internalDbClient`DELETE FROM ${internalDbClient(schemaName)}.${internalDbClient(tableName)};`
        } else {
          await internalDbClient`DELETE FROM queue_jobs`
        }

        adapter = await ctx.initAdapter(
          db,
          useDefault === false ? { modelName, schemaName, tableName } : {}
        )

        await adapter.connect()
        adapter.setQueueName("test-queue")
      })

      describe("addJob / getJobById", () => {
        it("should add a job and retrieve it by ID", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test-job",
            payload: { data: "test" },
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          expect(job.id).toBeDefined()
          expect(job.name).toBe("test-job")
          expect(job.payload).toEqual({ data: "test" })
          expect(job.status).toBe("pending")

          const retrieved = await adapter.getJobById(job.id)
          expect(retrieved).not.toBeNull()
          expect(retrieved?.id).toBe(job.id)
          expect(retrieved?.name).toBe("test-job")
        })

        it("should return null for unknown ID", async () => {
          const result = await adapter.getJobById(
            "00000000-0000-0000-0000-000000000000"
          )
          expect(result).toBeNull()
        })
      })

      describe("addJobs (batch)", () => {
        it("should add multiple jobs", async () => {
          const jobs = await adapter.addJobs([
            {
              attempts: 0,
              maxAttempts: 2,
              name: "batch-1",
              payload: { n: 1 },
              priority: 1,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 2,
              name: "batch-2",
              payload: { n: 2 },
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
          ])

          expect(jobs).toHaveLength(2)
          expect(jobs[0]?.name).toBe("batch-1")
          expect(jobs[1]?.name).toBe("batch-2")
        })
      })

      describe("dependsOn persistence", () => {
        it("should persist and return dependsOn via addJob", async () => {
          const depIds = [
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
          ]
          const job = await adapter.addJob({
            attempts: 0,
            dependsOn: depIds,
            maxAttempts: 3,
            name: "dependent-job",
            payload: { test: true },
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          expect(job.dependsOn).toStrictEqual(depIds)

          const retrieved = await adapter.getJobById(job.id)
          expect(retrieved?.dependsOn).toStrictEqual(depIds)
        })

        it("should persist and return dependsOn via addJobs", async () => {
          const depIds = ["00000000-0000-0000-0000-000000000003"]
          const jobs = await adapter.addJobs([
            {
              attempts: 0,
              dependsOn: depIds,
              maxAttempts: 3,
              name: "batch-dep",
              payload: {},
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
          ])

          expect(jobs[0]?.dependsOn).toStrictEqual(depIds)

          const retrieved = await adapter.getJobById(jobs[0]?.id ?? "")
          expect(retrieved?.dependsOn).toStrictEqual(depIds)
        })

        it("should return undefined dependsOn when not set", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "no-deps",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          expect(job.dependsOn).toBeUndefined()
        })

        it("should persist and return onDependencyFailure", async () => {
          const depIds = ["00000000-0000-0000-0000-000000000001"]
          const job = await adapter.addJob({
            attempts: 0,
            dependsOn: depIds,
            maxAttempts: 3,
            name: "dep-fail-policy",
            onDependencyFailure: "cancel",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          expect(job.onDependencyFailure).toBe("cancel")

          const retrieved = await adapter.getJobById(job.id)
          expect(retrieved?.onDependencyFailure).toBe("cancel")
        })

        it("should persist onDependencyFailure via addJobs", async () => {
          const depIds = ["00000000-0000-0000-0000-000000000001"]
          const jobs = await adapter.addJobs([
            {
              attempts: 0,
              dependsOn: depIds,
              maxAttempts: 3,
              name: "batch-dep-policy",
              onDependencyFailure: "cancel",
              payload: {},
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
          ])

          expect(jobs[0]?.onDependencyFailure).toBe("cancel")

          const retrieved = await adapter.getJobById(jobs[0]?.id ?? "")
          expect(retrieved?.onDependencyFailure).toBe("cancel")
        })
      })

      describe("getNextJob", () => {
        it("should return highest priority job", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "low",
            payload: {},
            priority: 5,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "high",
            payload: {},
            priority: 1,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          const job = await adapter.getNextJob({
            activeGroups: [],
            handlerNames: ["low", "high"],
          })
          expect(job?.name).toBe("high")
        })

        it("should return null when no jobs available", async () => {
          const job = await adapter.getNextJob({
            activeGroups: [],
            handlerNames: ["nonexistent"],
          })
          expect(job).toBeNull()
        })

        it("should only return jobs for registered handlers", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "unregistered",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          const job = await adapter.getNextJob({
            activeGroups: [],
            handlerNames: ["other-handler"],
          })
          expect(job).toBeNull()
        })
      })

      describe("getNextJobsForHandler", () => {
        it("should return jobs for a specific handler", async () => {
          await adapter.addJobs([
            {
              attempts: 0,
              maxAttempts: 2,
              name: "target",
              payload: { n: 1 },
              priority: 1,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 2,
              name: "target",
              payload: { n: 2 },
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 2,
              name: "other",
              payload: { n: 3 },
              priority: 1,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
          ])

          const jobs = await adapter.getNextJobsForHandler("target", 10, [])
          expect(jobs).toHaveLength(2)
          expect(jobs.every((j) => j.name === "target")).toBe(true)
        })

        it("should respect count limit", async () => {
          await adapter.addJobs([
            {
              attempts: 0,
              maxAttempts: 2,
              name: "x",
              payload: {},
              priority: 1,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 2,
              name: "x",
              payload: {},
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 2,
              name: "x",
              payload: {},
              priority: 3,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
          ])

          const jobs = await adapter.getNextJobsForHandler("x", 2, [])
          expect(jobs).toHaveLength(2)
        })
      })

      describe("updateJobStatus", () => {
        it("should update status to processing", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          await adapter.updateJobStatus(job.id, { status: "processing" })

          const updated = await adapter.getJobById(job.id)
          expect(updated?.status).toBe("processing")
          expect(updated?.processedAt).toBeTruthy()
        })

        it("should update status to completed with result", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          await adapter.updateJobStatus(job.id, {
            result: { ok: true },
            status: "completed",
          })

          const updated = await adapter.getJobById(job.id)
          expect(updated?.status).toBe("completed")
          expect(updated?.completedAt).toBeTruthy()
          expect(updated?.result).toEqual({ ok: true })
        })

        it("should update status to failed with error", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          await adapter.updateJobStatus(job.id, {
            error: { message: "test error", name: "Error" },
            status: "failed",
          })

          const updated = await adapter.getJobById(job.id)
          expect(updated?.status).toBe("failed")
          expect(updated?.failedAt).toBeTruthy()
          expect(updated?.error?.message).toBe("test error")
        })
      })

      describe("incrementJobAttempts", () => {
        it("should increment attempts", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          await adapter.incrementJobAttempts(job.id)
          const updated = await adapter.getJobById(job.id)
          expect(updated?.attempts).toBe(1)
        })
      })

      describe("updateJobProgress", () => {
        it("should update progress", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "processing",
          })

          await adapter.updateJobProgress(job.id, 50)
          const updated = await adapter.getJobById(job.id)
          expect(updated?.progress).toBe(50)
        })

        it("should clamp progress to 0-100", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "processing",
          })

          await adapter.updateJobProgress(job.id, -10)
          let updated = await adapter.getJobById(job.id)
          expect(updated?.progress).toBe(0)

          await adapter.updateJobProgress(job.id, 150)
          updated = await adapter.getJobById(job.id)
          expect(updated?.progress).toBe(100)
        })
      })

      describe("cancelJob / cancelJobs", () => {
        it("should cancel a pending job", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          const result = await adapter.cancelJob(job.id, "no longer needed")
          expect(result).toBe(true)

          const updated = await adapter.getJobById(job.id)
          expect(updated?.status).toBe("cancelled")
          expect(updated?.cancellationReason).toBe("no longer needed")
          expect(updated?.cancelledAt).toBeTruthy()
        })

        it("should not cancel a completed job", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.updateJobStatus(job.id, { status: "completed" })

          const result = await adapter.cancelJob(job.id)
          expect(result).toBe(false)
        })

        it("should cancel multiple jobs by filter", async () => {
          await adapter.addJobs([
            {
              attempts: 0,
              maxAttempts: 3,
              name: "email",
              payload: {},
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 3,
              name: "email",
              payload: {},
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 3,
              name: "sms",
              payload: {},
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
          ])

          const count = await adapter.cancelJobs({ name: "email" })
          expect(count).toBe(2)
        })
      })

      describe("DLQ: getDeadJobs / redriveJob / redriveJobs", () => {
        it("should get dead jobs", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.updateJobStatus(job.id, { status: "dead" })

          const dead = await adapter.getDeadJobs()
          expect(dead.length).toBeGreaterThanOrEqual(1)
          expect(dead.some((j) => j.id === job.id)).toBe(true)
        })

        it("should redrive a dead job", async () => {
          const job = await adapter.addJob({
            attempts: 3,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.updateJobStatus(job.id, { status: "dead" })

          await adapter.redriveJob(job.id)
          const updated = await adapter.getJobById(job.id)
          expect(updated?.status).toBe("pending")
          expect(updated?.attempts).toBe(0)
        })

        it("should redrive all dead jobs", async () => {
          const j1 = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "a",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          const j2 = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "b",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.updateJobStatus(j1.id, { status: "dead" })
          await adapter.updateJobStatus(j2.id, { status: "dead" })

          const count = await adapter.redriveJobs()
          expect(count).toBe(2)
        })
      })

      describe("getQueueStats", () => {
        it("should return counts by status", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "a",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "b",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          const j3 = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "c",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.updateJobStatus(j3.id, { status: "completed" })

          const stats = await adapter.getQueueStats()
          expect(stats.pending).toBe(2)
          expect(stats.completed).toBe(1)
        })
      })

      describe("size", () => {
        it("should count pending + delayed jobs", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "a",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "b",
            payload: {},
            priority: 2,
            processAt: new Date(Date.now() + 60_000),
            progress: 0,
            repeatCount: 0,
            status: "delayed",
          })
          const j3 = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "c",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.updateJobStatus(j3.id, { status: "completed" })

          const size = await adapter.size()
          expect(size).toBe(2)
        })
      })

      describe("clearJobs / cleanupJobs", () => {
        it("should clear all jobs", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "a",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "b",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          const count = await adapter.clearJobs()
          expect(count).toBe(2)
        })

        it("should clear jobs by status", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "a",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          const j2 = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "b",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.updateJobStatus(j2.id, { status: "completed" })

          const count = await adapter.clearJobs("completed")
          expect(count).toBe(1)
        })
      })

      describe("findJobByUniqueKey", () => {
        it("should find active job by unique key", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
            uniqueKey: "unique-123",
          })

          const found = await adapter.findJobByUniqueKey("unique-123")
          expect(found).not.toBeNull()
          expect(found?.uniqueKey).toBe("unique-123")
        })

        it("should not find completed job by unique key", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
            uniqueKey: "done-key",
          })
          await adapter.updateJobStatus(job.id, { status: "completed" })

          const found = await adapter.findJobByUniqueKey("done-key")
          expect(found).toBeNull()
        })
      })

      describe("groups", () => {
        it("should skip active groups in getNextJob", async () => {
          await adapter.addJob({
            attempts: 0,
            groupKey: "g1",
            maxAttempts: 3,
            name: "grouped",
            payload: { n: 1 },
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })
          await adapter.addJob({
            attempts: 0,
            groupKey: "g2",
            maxAttempts: 3,
            name: "grouped",
            payload: { n: 2 },
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          const job = await adapter.getNextJob({
            activeGroups: ["g1"],
            handlerNames: ["grouped"],
          })
          expect(job?.groupKey).toBe("g2")
        })
      })

      describe("delayed jobs", () => {
        it("should not pick future delayed jobs", async () => {
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "delayed",
            payload: {},
            priority: 2,
            processAt: new Date(Date.now() + 60_000),
            progress: 0,
            repeatCount: 0,
            status: "delayed",
          })

          const job = await adapter.getNextJob({
            activeGroups: [],
            handlerNames: ["delayed"],
          })
          expect(job).toBeNull()
        })
      })

      describe("cron fields", () => {
        it("should store and retrieve cron expression", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            cron: "0 9 * * *",
            maxAttempts: 3,
            name: "cron-job",
            payload: {},
            priority: 2,
            processAt: new Date(Date.now() + 60_000),
            progress: 0,
            repeatCount: 0,
            status: "delayed",
          })

          const retrieved = await adapter.getJobById(job.id)
          expect(retrieved?.cron).toBe("0 9 * * *")
        })

        it("should store repeat fields", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "repeat-job",
            payload: {},
            priority: 2,
            processAt: new Date(Date.now() + 60_000),
            progress: 0,
            repeatCount: 2,
            repeatEvery: 5000,
            repeatLimit: 10,
            status: "delayed",
          })

          const retrieved = await adapter.getJobById(job.id)
          expect(retrieved?.repeatEvery).toBe(5000)
          expect(retrieved?.repeatLimit).toBe(10)
          expect(retrieved?.repeatCount).toBe(2)
        })
      })

      describe("timeout", () => {
        it("should store timeout value", async () => {
          const job = await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "timeout-job",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
            timeout: 5000,
          })

          const retrieved = await adapter.getJobById(job.id)
          expect(retrieved?.timeout).toBe(5000)
        })
      })

      describe("SKIP LOCKED concurrency", () => {
        it("should skip a row locked by another transaction", async () => {
          const table =
            useDefault === false ? `${schemaName}.${tableName}` : "queue_jobs"

          // Insert two jobs with different priorities
          await adapter.addJobs([
            {
              attempts: 0,
              maxAttempts: 3,
              name: "lock-test",
              payload: { n: 1 },
              priority: 1,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
            {
              attempts: 0,
              maxAttempts: 3,
              name: "lock-test",
              payload: { n: 2 },
              priority: 2,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending",
            },
          ])

          // Open a separate connection and hold a FOR UPDATE lock on the
          // highest-priority job (simulates a worker holding the lock).
          const lockClient = postgres(database.container.getConnectionUri(), {
            max: 1,
          })

          // oxlint-disable-next-line promise/avoid-new
          const lockedId = await new Promise<string>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            lockClient.begin(async (tx) => {
              const [row] = await tx<{ id: string }[]>`
                SELECT id FROM ${tx.unsafe(table)}
                WHERE queue_name = 'test-queue'
                  AND status = 'pending'
                  AND name = 'lock-test'
                ORDER BY priority ASC, created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
              `
              // oxlint-disable-next-line typescript/no-non-null-assertion
              resolve(row!.id)

              // Hold the transaction open so the lock persists
              // oxlint-disable-next-line no-promise-executor-return promise/avoid-new promise/param-names
              await new Promise((r) => setTimeout(r, 2000))
            })
          })

          // While the lock is held, adapter.getNextJob should skip the locked
          // row and return the second job instead.
          const job = await adapter.getNextJob({
            activeGroups: [],
            handlerNames: ["lock-test"],
          })

          expect(job).not.toBeNull()
          // oxlint-disable-next-line typescript/no-non-null-assertion
          expect(job!.id).not.toBe(lockedId)
          // oxlint-disable-next-line typescript/no-non-null-assertion
          expect((job!.payload as { n: number }).n).toBe(2)

          await lockClient.end()
        })

        it("should return null when all rows are locked", async () => {
          const table =
            useDefault === false ? `${schemaName}.${tableName}` : "queue_jobs"

          // Insert a single job
          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "lock-all-test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          // Lock it in a separate transaction
          const lockClient = postgres(database.container.getConnectionUri(), {
            max: 1,
          })

          // oxlint-disable-next-line promise/avoid-new
          await new Promise<void>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            lockClient.begin(async (tx) => {
              await tx`
                SELECT id FROM ${tx.unsafe(table)}
                WHERE queue_name = 'test-queue'
                  AND status = 'pending'
                  AND name = 'lock-all-test'
                LIMIT 1
                FOR UPDATE SKIP LOCKED
              `
              resolve()

              // oxlint-disable-next-line promise/avoid-new promise/param-names no-promise-executor-return
              await new Promise((r) => setTimeout(r, 2000))
            })
          })

          // Adapter should find no available jobs (the only one is locked)
          const job = await adapter.getNextJob({
            activeGroups: [],
            handlerNames: ["lock-all-test"],
          })

          expect(job).toBeNull()

          await lockClient.end()
        })

        it("should skip locked rows in getNextJobsForHandler", async () => {
          const table =
            useDefault === false ? `${schemaName}.${tableName}` : "queue_jobs"

          // Insert 3 jobs
          await adapter.addJobs(
            Array.from({ length: 3 }, (_, i) => ({
              attempts: 0,
              maxAttempts: 3,
              name: "batch-lock-test",
              payload: { index: i },
              priority: i + 1,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              status: "pending" as const,
            }))
          )

          // Lock the first (highest priority) job
          const lockClient = postgres(database.container.getConnectionUri(), {
            max: 1,
          })

          // oxlint-disable-next-line promise/avoid-new
          const lockedId = await new Promise<string>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            lockClient.begin(async (tx) => {
              const [row] = await tx<{ id: string }[]>`
                SELECT id FROM ${tx.unsafe(table)}
                WHERE queue_name = 'test-queue'
                  AND status = 'pending'
                  AND name = 'batch-lock-test'
                ORDER BY priority ASC, created_at ASC
                LIMIT 1
                FOR UPDATE
              `
              // oxlint-disable-next-line typescript/no-non-null-assertion
              resolve(row!.id)

              // oxlint-disable-next-line promise/avoid-new promise/param-names no-promise-executor-return
              await new Promise((r) => setTimeout(r, 2000))
            })
          })

          // Request all 3, but one is locked so only 2 should be returned
          const jobs = await adapter.getNextJobsForHandler(
            "batch-lock-test",
            3,
            []
          )

          expect(jobs.length).toBe(2)
          expect(jobs.every((j) => j.id !== lockedId)).toBe(true)

          await lockClient.end()
        })

        it("should release lock after transaction completes", async () => {
          const table =
            useDefault === false ? `${schemaName}.${tableName}` : "queue_jobs"

          await adapter.addJob({
            attempts: 0,
            maxAttempts: 3,
            name: "release-test",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
          })

          // Lock and immediately release via transaction commit
          const lockClient = postgres(database.container.getConnectionUri(), {
            max: 1,
          })

          await lockClient.begin(async (tx) => {
            await tx`
              SELECT id FROM ${tx.unsafe(table)}
              WHERE queue_name = 'test-queue'
                AND status = 'pending'
                AND name = 'release-test'
              LIMIT 1
              FOR UPDATE SKIP LOCKED
            `
          })

          await lockClient.end()

          // After the lock is released, getNextJob should find the job
          const job = await adapter.getNextJob({
            activeGroups: [],
            handlerNames: ["release-test"],
          })

          expect(job).not.toBeNull()
          // oxlint-disable-next-line typescript/no-non-null-assertion
          expect(job!.name).toBe("release-test")
        })
      })
    }
  )
}
