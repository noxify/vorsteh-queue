import path from "path"
import type { StartedTestContainer } from "testcontainers"
import { PrismaPg } from "@prisma/adapter-pg"
import PrismaInternals from "@prisma/internals"
import PrismaMigrate from "@prisma/migrate"
import { GenericContainer } from "testcontainers"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { PostgresPrismaQueueAdapter } from "~/index"
import { PrismaClient } from "../src/generated/prisma/client"

// based on
// https://github.com/prisma/prisma/issues/13549#issuecomment-1987343945
async function prepareTable() {
  let migrate

  try {
    const schemaPathResult = await PrismaInternals.getSchemaWithPath(
      path.join(__dirname, "../prisma/schema.prisma"),
    )
    if (!schemaPathResult.schemaPath) {
      // eslint-disable-next-line no-console
      console.error("No schema found")
      return { result: false }
    }

    const migrationsDirPath = path.join(schemaPathResult.schemaRootDir, "migrations")
    const schemaContext = { schemaFiles: schemaPathResult.schemas } as PrismaInternals.SchemaContext
    migrate = await PrismaMigrate.Migrate.setup({
      migrationsDirPath,
      schemaContext,
    })

    await migrate.push({ force: true })

    return { result: true }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log({ error })
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

    const prismaAdapter = new PrismaPg({ connectionString: databaseUrl })
    prisma = new PrismaClient({ adapter: prismaAdapter })

    await prepareTable()
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

  describe("Timezone Handling", () => {
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

  describe("result Handling", () => {
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

      const updated = await prisma.$queryRaw<
        { status: string; result: unknown; completed_at: Date | null }[]
      >`
      SELECT status, result, completed_at FROM queue_jobs WHERE id = ${job.id}
    `

      expect(updated[0]?.status).toBe("completed")
      expect(updated[0]?.result).toEqual(result)
      expect(updated[0]?.completed_at).toBeTruthy()
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

      const updated = await prisma.$queryRaw<{ result: unknown }[]>`
      SELECT result FROM queue_jobs WHERE id = ${job.id}
    `

      expect(updated[0]?.result).toBeNull()
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

      // Get the completed job directly from database
      const dbJob = await prisma.$queryRaw<{ result: unknown }[]>`
      SELECT result FROM queue_jobs WHERE id = ${job.id}
    `

      expect(dbJob[0]?.result).toEqual(result)
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

      const updated = await prisma.$queryRaw<{ result: unknown; status: string }[]>`
      SELECT result, status FROM queue_jobs WHERE id = ${job.id}
    `

      expect(updated[0]?.result).toEqual(result)
      expect(updated[0]?.status).toBe("completed")
    })
  })
})
