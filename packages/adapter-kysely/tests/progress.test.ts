import { promises as fs } from "fs"
import * as path from "path"
import { PGlite } from "@electric-sql/pglite"
import { FileMigrationProvider, Kysely, Migrator } from "kysely"
import { PGliteDialect } from "kysely-pglite-dialect"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { DB } from "~/types"
import { PostgresQueueAdapter } from "~/index"

describe("PostgresQueueAdapter Progress", () => {
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
    const updated = await db
      .selectFrom("queue_jobs")
      .select("progress")
      .where("id", "=", job.id)
      .executeTakeFirst()

    expect(updated?.progress).toBe(50)

    // Update progress to 100%
    await adapter.updateJobProgress(job.id, 100)

    // Verify progress was updated again

    const completed = await db
      .selectFrom("queue_jobs")
      .select("progress")
      .where("id", "=", job.id)
      .executeTakeFirst()

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

    let result = await db
      .selectFrom("queue_jobs")
      .select("progress")
      .where("id", "=", job.id)
      .executeTakeFirst()

    expect(result?.progress).toBe(0)

    await adapter.updateJobProgress(job.id, 150)
    result = await db
      .selectFrom("queue_jobs")
      .select("progress")
      .where("id", "=", job.id)
      .executeTakeFirst()
    expect(result?.progress).toBe(100)
  })
})
