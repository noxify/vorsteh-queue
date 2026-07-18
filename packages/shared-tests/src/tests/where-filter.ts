import type { JobWhereInput, QueueAdapter } from "@vorsteh-queue/core"
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

export function runWhereFilterTests<TDatabase = unknown>(
  ctx: SharedTestContext<TDatabase>
) {
  describe.each(ctx.testCases)(
    "Where Filter Tests - $description",
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

        // Seed jobs with different characteristics
        await adapter.addJobs([
          {
            attempts: 0,
            maxAttempts: 3,
            name: "send-email",
            payload: {},
            priority: 1,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
            groupKey: "email",
          },
          {
            attempts: 0,
            maxAttempts: 3,
            name: "send-sms",
            payload: {},
            priority: 2,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "pending",
            groupKey: "sms",
          },
          {
            attempts: 0,
            maxAttempts: 3,
            name: "process-payment",
            payload: {},
            priority: 1,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "completed",
          },
          {
            attempts: 0,
            maxAttempts: 3,
            name: "send-email",
            payload: {},
            priority: 3,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            status: "failed",
            groupKey: "email",
          },
          {
            attempts: 0,
            cron: "0 * * * *",
            maxAttempts: 3,
            name: "generate-report",
            payload: {},
            priority: 2,
            processAt: new Date(Date.now() + 60_000),
            progress: 0,
            repeatCount: 0,
            status: "delayed",
          },
        ])
      })

      describe("status filter", () => {
        it("should filter by status eq", async () => {
          const jobs = await adapter.getJobs({
            where: { status: { eq: "pending" } },
          })

          expect(jobs).toHaveLength(2)
          expect(jobs.every((j) => j.status === "pending")).toBe(true)
        })

        it("should filter by status in (multiple statuses)", async () => {
          const jobs = await adapter.getJobs({
            where: { status: { in: ["pending", "failed"] } },
          })

          expect(jobs).toHaveLength(3)
          expect(
            jobs.every((j) => j.status === "pending" || j.status === "failed")
          ).toBe(true)
        })
      })

      describe("name filter", () => {
        it("should filter by name eq", async () => {
          const jobs = await adapter.getJobs({
            where: { name: { eq: "send-email" } },
          })

          expect(jobs).toHaveLength(2)
          expect(jobs.every((j) => j.name === "send-email")).toBe(true)
        })

        it("should filter by name contains", async () => {
          const jobs = await adapter.getJobs({
            where: { name: { contains: "send" } },
          })

          expect(jobs).toHaveLength(3)
          expect(jobs.every((j) => j.name.includes("send"))).toBe(true)
        })

        it("should filter by name startsWith", async () => {
          const jobs = await adapter.getJobs({
            where: { name: { startsWith: "send" } },
          })

          expect(jobs).toHaveLength(3)
          expect(jobs.every((j) => j.name.startsWith("send"))).toBe(true)
        })
      })

      describe("priority filter", () => {
        it("should filter by priority lt", async () => {
          const jobs = await adapter.getJobs({
            where: { priority: { lt: 2 } },
          })

          expect(jobs).toHaveLength(2)
          expect(jobs.every((j) => j.priority < 2)).toBe(true)
        })

        it("should filter by priority lte", async () => {
          const jobs = await adapter.getJobs({
            where: { priority: { lte: 2 } },
          })

          expect(jobs).toHaveLength(4)
          expect(jobs.every((j) => j.priority <= 2)).toBe(true)
        })

        it("should filter by priority gt", async () => {
          const jobs = await adapter.getJobs({
            where: { priority: { gt: 2 } },
          })

          expect(jobs).toHaveLength(1)
          expect(jobs.every((j) => j.priority > 2)).toBe(true)
        })

        it("should filter by priority gte", async () => {
          const jobs = await adapter.getJobs({
            where: { priority: { gte: 2 } },
          })

          expect(jobs).toHaveLength(3)
          expect(jobs.every((j) => j.priority >= 2)).toBe(true)
        })
      })

      describe("cron isNull filter", () => {
        it("should filter by cron isNull true (no cron)", async () => {
          const jobs = await adapter.getJobs({
            where: { cron: { isNull: true } },
          })

          expect(jobs).toHaveLength(4)
          expect(
            jobs.every((j) => j.cron === null || j.cron === undefined)
          ).toBe(true)
        })

        it("should filter by cron isNull false (has cron)", async () => {
          const jobs = await adapter.getJobs({
            where: { cron: { isNull: false } },
          })

          expect(jobs).toHaveLength(1)
          expect(
            jobs.every((j) => j.cron !== null && j.cron !== undefined)
          ).toBe(true)
          expect(jobs[0]?.name).toBe("generate-report")
        })
      })

      describe("status neq filter", () => {
        it("should filter by status neq", async () => {
          const jobs = await adapter.getJobs({
            where: { status: { neq: "pending" } },
          })

          expect(jobs).toHaveLength(3)
          expect(jobs.every((j) => j.status !== "pending")).toBe(true)
        })
      })

      describe("name like filter", () => {
        it("should filter by name like pattern", async () => {
          const jobs = await adapter.getJobs({
            where: { name: { like: "send-%" } },
          })

          expect(jobs).toHaveLength(3)
          expect(jobs.every((j) => j.name.startsWith("send-"))).toBe(true)
        })
      })

      describe("name in filter", () => {
        it("should filter by name in array", async () => {
          const jobs = await adapter.getJobs({
            where: { name: { in: ["send-email", "process-payment"] } },
          })

          expect(jobs).toHaveLength(3)
          expect(
            jobs.every(
              (j) => j.name === "send-email" || j.name === "process-payment"
            )
          ).toBe(true)
        })
      })

      describe("groupKey filter", () => {
        it("should filter by groupKey isNull true", async () => {
          const jobs = await adapter.getJobs({
            where: { groupKey: { isNull: true } },
          })

          expect(jobs).toHaveLength(2)
          expect(
            jobs.every((j) => j.groupKey === null || j.groupKey === undefined)
          ).toBe(true)
        })

        it("should filter by groupKey isNull false", async () => {
          const jobs = await adapter.getJobs({
            where: { groupKey: { isNull: false } },
          })

          expect(jobs).toHaveLength(3)
          expect(
            jobs.every((j) => j.groupKey !== null && j.groupKey !== undefined)
          ).toBe(true)
        })

        it("should filter by groupKey eq", async () => {
          const jobs = await adapter.getJobs({
            where: { groupKey: { eq: "email" } },
          })

          expect(jobs).toHaveLength(2)
          expect(jobs.every((j) => j.groupKey === "email")).toBe(true)
        })
      })

      describe("compound filters", () => {
        it("should filter with AND compound", async () => {
          const where: JobWhereInput = {
            AND: [{ status: { eq: "pending" } }, { priority: { lte: 1 } }],
          }

          const jobs = await adapter.getJobs({ where })

          expect(jobs).toHaveLength(1)
          expect(jobs[0]?.name).toBe("send-email")
          expect(jobs[0]?.status).toBe("pending")
          expect(jobs[0]?.priority).toBe(1)
        })

        it("should filter with OR compound", async () => {
          const where: JobWhereInput = {
            OR: [
              { status: { eq: "completed" } },
              { status: { eq: "delayed" } },
            ],
          }

          const jobs = await adapter.getJobs({ where })

          expect(jobs).toHaveLength(2)
          expect(
            jobs.every(
              (j) => j.status === "completed" || j.status === "delayed"
            )
          ).toBe(true)
        })
      })

      describe("size with where filter", () => {
        it("should return count of matching jobs", async () => {
          const count = await adapter.size({ status: { eq: "pending" } })

          expect(count).toBe(2)
        })

        it("should return count with compound filter", async () => {
          const count = await adapter.size({
            name: { startsWith: "send" },
          })

          expect(count).toBe(3)
        })
      })

      describe("empty where", () => {
        it("should return all jobs when where is empty", async () => {
          const jobs = await adapter.getJobs({ where: {} })

          expect(jobs).toHaveLength(5)
        })

        it("should return all jobs when where is undefined", async () => {
          const jobs = await adapter.getJobs({})

          expect(jobs).toHaveLength(5)
        })
      })
    }
  )
}
