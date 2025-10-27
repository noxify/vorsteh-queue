import postgres from "postgres"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { QueueAdapter } from "@vorsteh-queue/core"

import type { SharedTestContext } from "../types"
import { initDatabase } from "../database"

export function runTests<TDatabase = unknown>(ctx: SharedTestContext<TDatabase>) {
  describe("Progress Tests", () => {
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

    it("should update job progress", async () => {
      // Add a job
      const job = await adapter.addJob({
        name: "progress-test",
        payload: { data: "test" },
        status: "processing",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      // Update progress to 50%
      await adapter.updateJobProgress(job.id, 50)

      // Verify progress was updated in database
      const [updated]: [{ progress: number }?] =
        await internalDbClient`SELECT progress FROM queue_jobs WHERE id=${job.id}`

      expect(updated?.progress).toBe(50)

      // Update progress to 100%
      await adapter.updateJobProgress(job.id, 100)

      // Verify progress was updated again
      const [completed]: [{ progress: number }?] =
        await internalDbClient`SELECT progress FROM queue_jobs WHERE id=${job.id}`

      expect(completed?.progress).toBe(100)
    })

    it("should normalize progress values", async () => {
      // Add a job
      const job = await adapter.addJob({
        name: "progress-test",
        payload: { data: "test" },
        status: "processing",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
      })

      // Test with out-of-range values
      await adapter.updateJobProgress(job.id, -10)
      const [failed1]: [{ progress: number }?] =
        await internalDbClient`SELECT progress FROM queue_jobs WHERE id=${job.id}`

      expect(failed1?.progress).toBe(0)

      await adapter.updateJobProgress(job.id, 150)
      const [failed2]: [{ progress: number }?] =
        await internalDbClient`SELECT progress FROM queue_jobs WHERE id=${job.id}`

      expect(failed2?.progress).toBe(100)
    })
  })
}
