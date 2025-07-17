import { PGlite } from "@electric-sql/pglite"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { DrizzleQueueAdapter } from "~/index"
import * as schema from "~/schema"

// Import pushSchema from drizzle-kit/api
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
const { pushSchema } = require("drizzle-kit/api") as typeof import("drizzle-kit/api")

describe("DrizzleQueueAdapter Progress", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>
  let adapter: DrizzleQueueAdapter
  let client: PGlite

  beforeEach(async () => {
    client = new PGlite()
    db = drizzle(client, { schema })

    // Apply schema using drizzle-kit/api
    const { apply } = await pushSchema(schema, db as never)
    await apply()

    adapter = new DrizzleQueueAdapter(db, "test-queue")
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
    const [updated] = await db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))

    expect(updated?.progress).toBe(50)

    // Update progress to 100%
    await adapter.updateJobProgress(job.id, 100)

    // Verify progress was updated again
    const [completed] = await db
      .select()
      .from(schema.queueJobs)
      .where(eq(schema.queueJobs.id, job.id))

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
    let result = await db.select().from(schema.queueJobs).where(eq(schema.queueJobs.id, job.id))
    expect(result[0]?.progress).toBe(0)

    await adapter.updateJobProgress(job.id, 150)
    result = await db.select().from(schema.queueJobs).where(eq(schema.queueJobs.id, job.id))
    expect(result[0]?.progress).toBe(100)
  })
})
