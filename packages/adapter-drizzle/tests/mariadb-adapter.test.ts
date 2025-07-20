import type { StartedTestContainer } from "testcontainers"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { MariaDBQueueAdapter } from "~/index"
import * as schema from "~/mariadb-schema"

describe("MariaDBQueueAdapter", () => {
  let container: StartedTestContainer
  let connection: mysql.Connection
  let db: ReturnType<typeof drizzle<typeof schema>>
  let adapter: MariaDBQueueAdapter

  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log("🐳 Starting MariaDB container...")

    // Start MySQL container (compatible with MariaDB adapter)
    container = await new GenericContainer("mariadb:latest")
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: "testpassword",
        MYSQL_DATABASE: "testdb",
      })
      .withExposedPorts(3306)
      .withStartupTimeout(60000) // 60 seconds
      .start()

    // eslint-disable-next-line no-console
    console.log("✅ MariaDB container started")

    // Connect to MariaDB
    connection = await mysql.createConnection({
      host: container.getHost(),
      port: container.getMappedPort(3306),
      user: "root",
      password: "testpassword",
      database: "testdb",
    })

    // eslint-disable-next-line no-console
    console.log("✅ Connected to MariaDB")

    // Create Drizzle instance
    db = drizzle(connection, { schema, mode: "default" }) as unknown as ReturnType<
      typeof drizzle<typeof schema>
    >

    // @TODO Check later how to switch to `pushSchema`
    /*
      Old code ( check the postgres adapter tests to see how to implement it):

        // Import pushSchema from drizzle-kit/api
        // Source: https://github.com/drizzle-team/drizzle-orm/issues/4205
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
        const { pushSchema } = require("drizzle-kit/api") as typeof import("drizzle-kit/api")

        // ...

        const { apply } = await pushSchema(schema, db as never)
        await apply()
    */
    // Apply schema manually (pushSchema has compatibility issues with MariaDB)
    // eslint-disable-next-line no-console
    console.log("📋 Creating tables...")
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        queue_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        payload JSON NOT NULL,
        status VARCHAR(50) NOT NULL,
        priority INT NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        process_at TIMESTAMP NOT NULL,
        processed_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        failed_at TIMESTAMP NULL,
        error JSON NULL,
        progress INT DEFAULT 0,
        cron VARCHAR(255) NULL,
        repeat_every INT NULL,
        repeat_limit INT NULL,
        repeat_count INT DEFAULT 0,
        INDEX idx_queue_jobs_status_priority (queue_name, status, priority, created_at),
        INDEX idx_queue_jobs_process_at (process_at)
      )
    `)
    // eslint-disable-next-line no-console
    console.log("✅ Tables created")
  }, 120000) // 2 minutes timeout

  beforeEach(async () => {
    // Clean up before each test
    await db.delete(schema.queueJobs)

    adapter = new MariaDBQueueAdapter(db)
    adapter.setQueueName("test-queue")
    await adapter.connect()
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (connection) {
      await connection.end()
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (container) {
      await container.stop()
    }
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
        repeatCount: 0,
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
        repeatCount: 0,
      })

      await adapter.addJob({
        name: "job-2",
        payload: { order: 2 },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        repeatCount: 0,
      })

      const job = await adapter.getNextJob()
      expect(job).toBeTruthy()
      expect(job?.name).toBe("job-1") // Higher priority first
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
        repeatCount: 0,
      })

      await adapter.updateJobStatus(job.id, "processing")

      const [updated] = await db
        .select()
        .from(schema.queueJobs)
        .where(eq(schema.queueJobs.id, job.id))

      expect(updated?.status).toBe("processing")
      expect(updated?.processedAt).toBeTruthy()
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
        repeatCount: 0,
      })

      await adapter.addJob({
        name: "job-2",
        payload: {},
        status: "completed",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        repeatCount: 0,
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
        repeatCount: 0,
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
        repeatCount: 0,
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
        repeatCount: 0,
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

  describe("MariaDB-specific features", () => {
    it("should use VARCHAR(36) for IDs", async () => {
      const job = await adapter.addJob({
        name: "id-test",
        payload: { test: "uuid" },
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        repeatCount: 0,
      })

      // MariaDB UUID format: 8-4-4-4-12 characters
      expect(job.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    })

    it("should handle JSON payload correctly", async () => {
      const complexPayload = {
        nested: { data: "test" },
        array: [1, 2, 3],
        boolean: true,
        number: 42,
      }

      const job = await adapter.addJob({
        name: "json-test",
        payload: complexPayload,
        status: "pending",
        priority: 2,
        attempts: 0,
        maxAttempts: 3,
        processAt: new Date(),
        repeatCount: 0,
      })

      expect(job.payload).toEqual(complexPayload)
    })
  })
})
