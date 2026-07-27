import { describe, expect, it } from "vitest"

import { buildWhere } from "~/drizzle"
import type { NormalizedJobWhereInput } from "~/types"

describe("buildWhere (Drizzle)", () => {
  describe("empty input", () => {
    it("returns empty object for empty where input", () => {
      const result = buildWhere({})
      expect(result).toStrictEqual({})
    })

    it("returns object with empty AND array for empty AND array", () => {
      const where: NormalizedJobWhereInput = { AND: [] }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ AND: [] })
    })

    it("returns object with empty OR array for empty OR array", () => {
      const where: NormalizedJobWhereInput = { OR: [] }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ OR: [] })
    })
  })

  describe("string filters", () => {
    it("maps eq operator to { eq: value }", () => {
      const where: NormalizedJobWhereInput = { name: { eq: "send-email" } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ name: { eq: "send-email" } })
    })

    it("maps neq operator to { ne: value }", () => {
      const where: NormalizedJobWhereInput = { name: { neq: "old-job" } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ name: { ne: "old-job" } })
    })

    it("maps contains operator to { like: '%value%' }", () => {
      const where: NormalizedJobWhereInput = { name: { contains: "email" } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ name: { like: "%email%" } })
    })

    it("maps startsWith operator to { like: 'value%' }", () => {
      const where: NormalizedJobWhereInput = { name: { startsWith: "send" } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ name: { like: "send%" } })
    })

    it("maps like operator to { like: pattern }", () => {
      const where: NormalizedJobWhereInput = { name: { like: "send-%" } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ name: { like: "send-%" } })
    })

    it("maps in operator to { in: [...] }", () => {
      const where: NormalizedJobWhereInput = {
        name: { in: ["send-email", "send-sms"] },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ name: { in: ["send-email", "send-sms"] } })
    })
  })

  describe("status filters", () => {
    it("maps status eq to { eq: value }", () => {
      const where: NormalizedJobWhereInput = { status: { eq: "pending" } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ status: { eq: "pending" } })
    })

    it("maps status neq to { ne: value }", () => {
      const where: NormalizedJobWhereInput = { status: { neq: "failed" } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ status: { ne: "failed" } })
    })

    it("maps status in to { in: [...] }", () => {
      const where: NormalizedJobWhereInput = {
        status: { in: ["pending", "failed"] },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ status: { in: ["pending", "failed"] } })
    })
  })

  describe("int filters", () => {
    it("maps eq operator to { eq: value }", () => {
      const where: NormalizedJobWhereInput = { priority: { eq: 5 } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ priority: { eq: 5 } })
    })

    it("maps neq operator to { ne: value }", () => {
      const where: NormalizedJobWhereInput = { priority: { neq: 0 } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ priority: { ne: 0 } })
    })

    it("maps lt operator to { lt: value }", () => {
      const where: NormalizedJobWhereInput = { priority: { lt: 5 } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ priority: { lt: 5 } })
    })

    it("maps lte operator to { lte: value }", () => {
      const where: NormalizedJobWhereInput = { priority: { lte: 3 } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ priority: { lte: 3 } })
    })

    it("maps gt operator to { gt: value }", () => {
      const where: NormalizedJobWhereInput = { priority: { gt: 1 } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ priority: { gt: 1 } })
    })

    it("maps gte operator to { gte: value }", () => {
      const where: NormalizedJobWhereInput = { attempts: { gte: 3 } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ attempts: { gte: 3 } })
    })
  })

  describe("datetime filters", () => {
    it("maps gte operator with Date to { gte: Date }", () => {
      const date = new Date("2024-01-01T00:00:00Z")
      const where: NormalizedJobWhereInput = { createdAt: { gte: date } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ createdAt: { gte: date } })
    })

    it("maps lt operator with ISO string to { lt: Date }", () => {
      const where: NormalizedJobWhereInput = {
        processAt: { lt: "2024-12-31T23:59:59Z" },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        processAt: { lt: new Date("2024-12-31T23:59:59Z") },
      })
    })

    it("maps gt operator to { gt: Date }", () => {
      const date = new Date("2024-06-01T00:00:00Z")
      const where: NormalizedJobWhereInput = { createdAt: { gt: date } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ createdAt: { gt: date } })
    })

    it("maps lte operator to { lte: Date }", () => {
      const date = new Date("2024-12-31T23:59:59Z")
      const where: NormalizedJobWhereInput = { processAt: { lte: date } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ processAt: { lte: date } })
    })
  })

  describe("isNull filters", () => {
    it("maps isNull true on NullFilter field to { isNull: true }", () => {
      const where: NormalizedJobWhereInput = { cron: { isNull: true } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ cron: { isNull: true } })
    })

    it("maps isNull false on NullFilter field to { isNotNull: true }", () => {
      const where: NormalizedJobWhereInput = { timeout: { isNull: false } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ timeout: { isNotNull: true } })
    })

    it("maps isNull true on StringFilter field to { isNull: true }", () => {
      const where: NormalizedJobWhereInput = { flowId: { isNull: true } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ flowId: { isNull: true } })
    })

    it("maps isNull false on StringFilter field to { isNotNull: true }", () => {
      const where: NormalizedJobWhereInput = { flowId: { isNull: false } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ flowId: { isNotNull: true } })
    })
  })

  describe("logical operators", () => {
    it("produces AND array with recursive where objects", () => {
      const where: NormalizedJobWhereInput = {
        AND: [{ status: { eq: "pending" } }, { priority: { lte: 3 } }],
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        AND: [{ status: { eq: "pending" } }, { priority: { lte: 3 } }],
      })
    })

    it("produces OR array with recursive where objects", () => {
      const where: NormalizedJobWhereInput = {
        OR: [{ status: { eq: "failed" } }, { status: { eq: "dead" } }],
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        OR: [{ status: { eq: "failed" } }, { status: { eq: "dead" } }],
      })
    })

    it("handles nested AND containing OR", () => {
      const where: NormalizedJobWhereInput = {
        AND: [
          {
            OR: [{ status: { eq: "pending" } }, { status: { eq: "delayed" } }],
          },
          { priority: { lte: 3 } },
        ],
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        AND: [
          {
            OR: [{ status: { eq: "pending" } }, { status: { eq: "delayed" } }],
          },
          { priority: { lte: 3 } },
        ],
      })
    })

    it("handles multiple top-level fields (implicit AND via object keys)", () => {
      const where: NormalizedJobWhereInput = {
        name: { eq: "send-email" },
        status: { eq: "pending" },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        name: { eq: "send-email" },
        status: { eq: "pending" },
      })
    })
  })

  describe("combined operators on single field", () => {
    it("merges multiple int operators into one object", () => {
      const where: NormalizedJobWhereInput = { priority: { gte: 1, lte: 5 } }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ priority: { gte: 1, lte: 5 } })
    })

    it("merges multiple datetime operators into one object", () => {
      const startDate = new Date("2024-01-01T00:00:00Z")
      const endDate = new Date("2024-12-31T23:59:59Z")
      const where: NormalizedJobWhereInput = {
        createdAt: { gte: startDate, lte: endDate },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        createdAt: { gte: startDate, lte: endDate },
      })
    })
  })

  describe("multi-field filters", () => {
    it("handles string + integer filter", () => {
      const where: NormalizedJobWhereInput = {
        name: { eq: "send-email" },
        priority: { lte: 3 },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        name: { eq: "send-email" },
        priority: { lte: 3 },
      })
    })

    it("handles string + integer + datetime filter", () => {
      const date = new Date("2024-01-01T00:00:00Z")
      const where: NormalizedJobWhereInput = {
        name: { eq: "send-email" },
        priority: { lte: 3 },
        createdAt: { gte: date },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({
        name: { eq: "send-email" },
        priority: { lte: 3 },
        createdAt: { gte: date },
      })
    })

    it("handles parentId with eq", () => {
      const where: NormalizedJobWhereInput = {
        parentId: { eq: "parent-123" },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ parentId: { eq: "parent-123" } })
    })

    it("handles parentId with isNull true", () => {
      const where: NormalizedJobWhereInput = {
        parentId: { isNull: true },
      }
      const result = buildWhere(where)
      expect(result).toStrictEqual({ parentId: { isNull: true } })
    })
  })
})
