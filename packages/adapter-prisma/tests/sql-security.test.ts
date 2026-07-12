import { describe, expect, it, vi } from "vitest"

import { PostgresQueueAdapter } from "../src"

type PrismaClientArg = ConstructorParameters<typeof PostgresQueueAdapter>[0]

/**
 * Regression tests for SQL injection prevention in the Prisma adapter.
 * These verify identifier validation and parameterization of dynamic values.
 */
describe("SQL Security Hardening", () => {
  describe("Identifier Validation (Constructor)", () => {
    const mockPrisma = {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
    } as unknown as PrismaClientArg

    it("rejects tableName with SQL injection payload", () => {
      expect(
        () =>
          new PostgresQueueAdapter(mockPrisma, {
            tableName: "jobs; DROP TABLE users;",
          })
      ).toThrow(/Invalid tableName/)
    })

    it("rejects tableName with quotes", () => {
      expect(
        () =>
          new PostgresQueueAdapter(mockPrisma, {
            tableName: 'jobs"--',
          })
      ).toThrow(/Invalid tableName/)
    })

    it("rejects tableName with spaces", () => {
      expect(
        () =>
          new PostgresQueueAdapter(mockPrisma, {
            tableName: "queue jobs",
          })
      ).toThrow(/Invalid tableName/)
    })

    it("rejects tableName with dots", () => {
      expect(
        () =>
          new PostgresQueueAdapter(mockPrisma, {
            tableName: "public.queue_jobs",
          })
      ).toThrow(/Invalid tableName/)
    })

    it("rejects schemaName with SQL injection payload", () => {
      expect(
        () =>
          new PostgresQueueAdapter(mockPrisma, {
            schemaName: "public; DROP TABLE users;",
          })
      ).toThrow(/Invalid schemaName/)
    })

    it("rejects schemaName with special characters", () => {
      expect(
        () =>
          new PostgresQueueAdapter(mockPrisma, {
            schemaName: "my-schema",
          })
      ).toThrow(/Invalid schemaName/)
    })

    it("accepts valid tableName with underscores", () => {
      expect(
        () => new PostgresQueueAdapter(mockPrisma, { tableName: "queue_jobs" })
      ).not.toThrow()
    })

    it("accepts valid schemaName with underscores and numbers", () => {
      expect(
        () =>
          new PostgresQueueAdapter(mockPrisma, {
            schemaName: "app_schema_v2",
            tableName: "queue_jobs",
          })
      ).not.toThrow()
    })

    it("accepts default configuration without throwing", () => {
      expect(() => new PostgresQueueAdapter(mockPrisma)).not.toThrow()
    })
  })

  describe("Handler Name Injection Attempt (Parameterized Values)", () => {
    it("does not embed handler names as SQL literals", () => {
      const queryRawUnsafe = vi.fn().mockResolvedValue([])
      const mockPrisma = {
        $connect: vi.fn(),
        $disconnect: vi.fn(),
        $queryRawUnsafe: queryRawUnsafe,
      } as unknown as PrismaClientArg

      const adapter = new PostgresQueueAdapter(mockPrisma)
      adapter.setQueueName("test-queue")

      // Handler names with SQL injection characters
      const maliciousHandlers = [
        "send-email'; DROP TABLE queue_jobs; --",
        'handler" OR 1=1 --',
        "normal-handler",
      ]

      void adapter.getNextJob({
        activeGroups: [],
        handlerNames: maliciousHandlers,
      })

      // Verify the query was called with parameterized placeholders
      const [sql, ...params] = queryRawUnsafe.mock.calls[0] as [
        string,
        ...unknown[],
      ]

      // SQL must contain $-placeholders, not interpolated handler names
      expect(sql).toContain("$2")
      expect(sql).toContain("$3")
      expect(sql).toContain("$4")
      expect(sql).not.toContain("send-email")
      expect(sql).not.toContain("DROP TABLE")
      expect(sql).not.toContain("OR 1=1")

      // Malicious values are passed as bound parameters only
      expect(params).toContain("send-email'; DROP TABLE queue_jobs; --")
      expect(params).toContain('handler" OR 1=1 --')
      expect(params).toContain("normal-handler")
    })

    it("does not embed group keys as SQL literals", async () => {
      const queryRawUnsafe = vi.fn().mockResolvedValue([])
      const mockPrisma = {
        $connect: vi.fn(),
        $disconnect: vi.fn(),
        $queryRawUnsafe: queryRawUnsafe,
      } as unknown as PrismaClientArg

      const adapter = new PostgresQueueAdapter(mockPrisma)
      adapter.setQueueName("test-queue")

      const maliciousGroups = ["group'; DROP TABLE queue_jobs; --"]

      await adapter.getNextJob({
        activeGroups: maliciousGroups,
        handlerNames: ["handler-a"],
      })

      // Second call is the pending-jobs query (first is delayed promotion)
      const { calls } = queryRawUnsafe.mock
      const pendingCall = calls[1] as [string, ...unknown[]]
      const [sql, ...params] = pendingCall

      // SQL must not contain interpolated group values
      expect(sql).not.toContain("DROP TABLE")
      expect(sql).toContain("NOT IN")

      // Malicious value is a bound parameter
      expect(params).toContain("group'; DROP TABLE queue_jobs; --")
    })

    it("parameterizes LIMIT in getNextJobsForHandler", () => {
      const queryRawUnsafe = vi.fn().mockResolvedValue([])
      const mockPrisma = {
        $connect: vi.fn(),
        $disconnect: vi.fn(),
        $queryRawUnsafe: queryRawUnsafe,
      } as unknown as PrismaClientArg

      const adapter = new PostgresQueueAdapter(mockPrisma)
      adapter.setQueueName("test-queue")

      void adapter.getNextJobsForHandler("send-email", 10, [])

      const [sql, ...params] = queryRawUnsafe.mock.calls[0] as [
        string,
        ...unknown[],
      ]

      // LIMIT is a placeholder, not a raw number in the SQL string
      expect(sql).toMatch(/LIMIT \$\d+/)
      expect(sql).not.toMatch(/LIMIT 10/)

      // 10 is passed as a bound parameter
      expect(params).toContain(10)
    })

    it("returns null for empty handlerNames without executing SQL", async () => {
      const queryRawUnsafe = vi.fn().mockResolvedValue([])
      const mockPrisma = {
        $connect: vi.fn(),
        $disconnect: vi.fn(),
        $queryRawUnsafe: queryRawUnsafe,
      } as unknown as PrismaClientArg

      const adapter = new PostgresQueueAdapter(mockPrisma)
      adapter.setQueueName("test-queue")

      const result = await adapter.getNextJob({
        activeGroups: [],
        handlerNames: [],
      })

      // No SQL should be executed when handlerNames is empty
      expect(queryRawUnsafe).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })
})
