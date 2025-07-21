import path from "path"
import type { StartedTestContainer } from "testcontainers"
import { PrismaClient } from "@prisma/client"
import PrismaInternals from "@prisma/internals"
import PrismaMigrate from "@prisma/migrate"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { PostgresPrismaQueueAdapter } from "~/index"

// based on
// https://github.com/prisma/prisma/issues/13549#issuecomment-1987343945
async function prepareTable() {
  let migrate

  try {
    const schemaPathResult = await PrismaInternals.getSchemaWithPath()
    if (!schemaPathResult.schemaPath) {
      // eslint-disable-next-line no-console
      console.error("No schema found")
      return { result: false }
    }

    const migrationsDirPath = path.join(schemaPathResult.schemaRootDir, "migrations")
    const schemaContext = { schemaFiles: schemaPathResult.schemas } as PrismaInternals.SchemaContext
    migrate = await PrismaMigrate.Migrate.setup({ migrationsDirPath, schemaContext })

    await migrate.push({ force: true })

    return { result: true }
  } catch (error) {
    return { result: false, error }
  } finally {
    void migrate?.stop()
  }
}

describe("PostgresPrismaQueueAdapter", () => {
  let container: StartedTestContainer
  let prisma: PrismaClient
  let adapter: PostgresPrismaQueueAdapter

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new GenericContainer("postgres:15")
      .withEnvironment({
        POSTGRES_PASSWORD: "testpassword",
        POSTGRES_USER: "testuser",
        POSTGRES_DB: "testdb",
      })
      .withExposedPorts(5432)
      .withStartupTimeout(60000)
      .start()

    // Create Prisma client
    const databaseUrl = `postgresql://testuser:testpassword@${container.getHost()}:${container.getMappedPort(5432)}/testdb`

    vi.stubEnv("DATABASE_URL", databaseUrl)

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })

    await prepareTable()

    // Create the queue_jobs table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        priority INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
        process_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        error JSONB,
        progress INTEGER DEFAULT 0,
        cron VARCHAR(255),
        repeat_every INTEGER,
        repeat_limit INTEGER,
        repeat_count INTEGER DEFAULT 0
      )
    `

    // Create indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_status_priority 
      ON queue_jobs (queue_name, status, priority, created_at)
    `

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_process_at 
      ON queue_jobs (process_at)
    `
  }, 120000)

  beforeEach(async () => {
    // Clean up before each test
    await prisma.$executeRaw`DELETE FROM queue_jobs`

    adapter = new PostgresPrismaQueueAdapter(prisma)
    adapter.setQueueName("test-queue")
    await adapter.connect()
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (prisma) {
      await prisma.$disconnect()
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
      })

      await adapter.updateJobStatus(job.id, "processing")

      const updated = await prisma.$queryRaw<{ status: string; processed_at: Date | null }[]>`
        SELECT status, processed_at FROM queue_jobs WHERE id = ${job.id}
      `

      expect(updated[0]?.status).toBe("processing")
      expect(updated[0]?.processed_at).toBeTruthy()
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

describe("PostgresPrismaQueueAdapter - Timezone Handling", () => {
  let container: StartedTestContainer
  let prisma: PrismaClient
  let adapter: PostgresPrismaQueueAdapter

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new GenericContainer("postgres:15")
      .withEnvironment({
        POSTGRES_PASSWORD: "testpassword",
        POSTGRES_USER: "testuser",
        POSTGRES_DB: "testdb",
      })
      .withExposedPorts(5432)
      .withStartupTimeout(60000)
      .start()

    // Create Prisma client
    const databaseUrl = `postgresql://testuser:testpassword@${container.getHost()}:${container.getMappedPort(5432)}/testdb`

    vi.stubEnv("DATABASE_URL", databaseUrl)

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })

    await prepareTable()

    // Create the queue_jobs table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        priority INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
        process_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        error JSONB,
        progress INTEGER DEFAULT 0,
        cron VARCHAR(255),
        repeat_every INTEGER,
        repeat_limit INTEGER,
        repeat_count INTEGER DEFAULT 0
      )
    `

    // Create indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_status_priority 
      ON queue_jobs (queue_name, status, priority, created_at)
    `

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_process_at 
      ON queue_jobs (process_at)
    `
  }, 120000)

  beforeEach(async () => {
    // Clean up before each test
    await prisma.$executeRaw`DELETE FROM queue_jobs`

    adapter = new PostgresPrismaQueueAdapter(prisma)
    adapter.setQueueName("test-queue")
    await adapter.connect()
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (prisma) {
      await prisma.$disconnect()
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (container) {
      await container.stop()
    }
  })

  it("should handle UTC timestamps correctly regardless of database timezone", async () => {
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
    const retrieved = await prisma.$queryRaw<{ process_at: Date }[]>`
      SELECT process_at FROM queue_jobs WHERE id = ${job.id}
    `

    // The processAt should match our input UTC time
    expect(retrieved[0]?.process_at.getTime()).toBe(testDate.getTime())

    // Update job status and check timestamp consistency
    await adapter.updateJobStatus(job.id, "processing")

    const updated = await prisma.$queryRaw<{ processed_at: Date | null }[]>`
      SELECT processed_at FROM queue_jobs WHERE id = ${job.id}
    `

    // processedAt should be a valid UTC timestamp
    expect(updated[0]?.processed_at).toBeTruthy()
    expect(updated[0]?.processed_at?.getTime()).toBeGreaterThan(testDate.getTime())
  })
})
