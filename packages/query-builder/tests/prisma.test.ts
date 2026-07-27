import { describe, expect, it } from "vitest"

import { buildWhere } from "~/prisma"
import type { NormalizedJobWhereInput } from "~/types"

describe("buildWhere (Prisma)", () => {
  describe("empty input", () => {
    it("returns empty object for empty where input", () => {
      const result = buildWhere({})
      expect(result).toEqual({})
    })
  })

  describe("string filters", () => {
    it("string eq", () => {
      const where: NormalizedJobWhereInput = { name: { eq: "send-email" } }
      const result = buildWhere(where)
      expect(result).toEqual({ name: "send-email" })
    })

    it("string neq", () => {
      const where: NormalizedJobWhereInput = { name: { neq: "x" } }
      const result = buildWhere(where)
      expect(result).toEqual({ name: { not: "x" } })
    })

    it("string contains", () => {
      const where: NormalizedJobWhereInput = { name: { contains: "email" } }
      const result = buildWhere(where)
      expect(result).toEqual({ name: { contains: "email" } })
    })

    it("string startsWith", () => {
      const where: NormalizedJobWhereInput = { name: { startsWith: "send" } }
      const result = buildWhere(where)
      expect(result).toEqual({ name: { startsWith: "send" } })
    })

    it("string in", () => {
      const where: NormalizedJobWhereInput = { name: { in: ["a", "b"] } }
      const result = buildWhere(where)
      expect(result).toEqual({ name: { in: ["a", "b"] } })
    })

    it("string like with % on both sides maps to contains", () => {
      const where: NormalizedJobWhereInput = { name: { like: "%email%" } }
      const result = buildWhere(where)
      expect(result).toEqual({ name: { contains: "email" } })
    })

    it("string like with trailing % maps to startsWith", () => {
      const where: NormalizedJobWhereInput = { name: { like: "send%" } }
      const result = buildWhere(where)
      expect(result).toEqual({ name: { startsWith: "send" } })
    })

    it("string isNull true", () => {
      const where: NormalizedJobWhereInput = { flowId: { isNull: true } }
      const result = buildWhere(where)
      expect(result).toEqual({ flowId: null })
    })

    it("string isNull false", () => {
      const where: NormalizedJobWhereInput = { flowId: { isNull: false } }
      const result = buildWhere(where)
      expect(result).toEqual({ flowId: { not: null } })
    })
  })

  describe("status filters", () => {
    it("status eq", () => {
      const where: NormalizedJobWhereInput = { status: { eq: "pending" } }
      const result = buildWhere(where)
      expect(result).toEqual({ status: "pending" })
    })

    it("status neq", () => {
      const where: NormalizedJobWhereInput = { status: { neq: "failed" } }
      const result = buildWhere(where)
      expect(result).toEqual({ status: { not: "failed" } })
    })

    it("status in", () => {
      const where: NormalizedJobWhereInput = {
        status: { in: ["pending", "failed"] },
      }
      const result = buildWhere(where)
      expect(result).toEqual({ status: { in: ["pending", "failed"] } })
    })
  })

  describe("int filters", () => {
    it("int eq", () => {
      const where: NormalizedJobWhereInput = { priority: { eq: 1 } }
      const result = buildWhere(where)
      expect(result).toEqual({ priority: 1 })
    })

    it("int neq", () => {
      const where: NormalizedJobWhereInput = { priority: { neq: 5 } }
      const result = buildWhere(where)
      expect(result).toEqual({ priority: { not: 5 } })
    })

    it("int lt", () => {
      const where: NormalizedJobWhereInput = { priority: { lt: 5 } }
      const result = buildWhere(where)
      expect(result).toEqual({ priority: { lt: 5 } })
    })

    it("int gte", () => {
      const where: NormalizedJobWhereInput = { priority: { gte: 1 } }
      const result = buildWhere(where)
      expect(result).toEqual({ priority: { gte: 1 } })
    })

    it("int multiple operators", () => {
      const where: NormalizedJobWhereInput = { priority: { gte: 1, lte: 5 } }
      const result = buildWhere(where)
      expect(result).toEqual({ priority: { gte: 1, lte: 5 } })
    })
  })

  describe("datetime filters", () => {
    it("datetime gte converts string to Date", () => {
      const where: NormalizedJobWhereInput = {
        createdAt: { gte: "2024-01-01" },
      }
      const result = buildWhere(where)
      expect(result).toEqual({
        createdAt: { gte: expect.any(Date) },
      })
      expect((result.createdAt as Record<string, Date>).gte).toEqual(
        new Date("2024-01-01")
      )
    })

    it("datetime isNull true", () => {
      const where: NormalizedJobWhereInput = { processedAt: { isNull: true } }
      const result = buildWhere(where)
      expect(result).toEqual({ processedAt: null })
    })
  })

  describe("null filters", () => {
    it("NullFilter isNull true", () => {
      const where: NormalizedJobWhereInput = { cron: { isNull: true } }
      const result = buildWhere(where)
      expect(result).toEqual({ cron: null })
    })

    it("NullFilter isNull false", () => {
      const where: NormalizedJobWhereInput = { cron: { isNull: false } }
      const result = buildWhere(where)
      expect(result).toEqual({ cron: { not: null } })
    })
  })

  describe("AND/OR recursion", () => {
    it("AND array is recursively built", () => {
      const where: NormalizedJobWhereInput = {
        AND: [{ status: { eq: "pending" } }, { priority: { gte: 1 } }],
      }
      const result = buildWhere(where)
      expect(result).toEqual({
        AND: [{ status: "pending" }, { priority: { gte: 1 } }],
      })
    })

    it("OR array is recursively built", () => {
      const where: NormalizedJobWhereInput = {
        OR: [{ status: { eq: "failed" } }, { status: { eq: "dead" } }],
      }
      const result = buildWhere(where)
      expect(result).toEqual({
        OR: [{ status: "failed" }, { status: "dead" }],
      })
    })
  })

  describe("parentId filters", () => {
    it("parentId isNull true", () => {
      const where: NormalizedJobWhereInput = { parentId: { isNull: true } }
      const result = buildWhere(where)
      expect(result).toEqual({ parentId: null })
    })

    it("parentId eq", () => {
      const where: NormalizedJobWhereInput = { parentId: { eq: "abc" } }
      const result = buildWhere(where)
      expect(result).toEqual({ parentId: "abc" })
    })
  })
})
