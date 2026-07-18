import { describe, expect, it } from "vitest"

import { normalizeWhere } from "~/normalize"
import type { JobWhereInput } from "~/types"

describe("normalizeWhere", () => {
  describe("empty / undefined input", () => {
    it("returns empty object for undefined input", () => {
      expect(normalizeWhere()).toEqual({})
    })

    it("returns empty object for empty object input", () => {
      expect(normalizeWhere({})).toEqual({})
    })
  })

  describe("string field shorthand expansion", () => {
    it("expands string shorthand for name", () => {
      expect(normalizeWhere({ name: "send-email" })).toEqual({
        name: { eq: "send-email" },
      })
    })

    it("expands string shorthand for all string fields", () => {
      const input: JobWhereInput = {
        id: "job-1",
        name: "send-email",
        uniqueKey: "unique-123",
        groupKey: "group-a",
        flowId: "flow-abc",
      }

      expect(normalizeWhere(input)).toEqual({
        id: { eq: "job-1" },
        name: { eq: "send-email" },
        uniqueKey: { eq: "unique-123" },
        groupKey: { eq: "group-a" },
        flowId: { eq: "flow-abc" },
      })
    })

    it("passes through full StringFilter unchanged", () => {
      const input: JobWhereInput = { name: { contains: "email" } }

      expect(normalizeWhere(input)).toEqual({
        name: { contains: "email" },
      })
    })
  })

  describe("status field", () => {
    it("expands status shorthand", () => {
      expect(normalizeWhere({ status: "pending" })).toEqual({
        status: { eq: "pending" },
      })
    })

    it("passes through full JobStatusFilter unchanged", () => {
      const input: JobWhereInput = { status: { in: ["pending", "failed"] } }

      expect(normalizeWhere(input)).toEqual({
        status: { in: ["pending", "failed"] },
      })
    })
  })

  describe("number field shorthand expansion", () => {
    it("expands number shorthand for priority", () => {
      expect(normalizeWhere({ priority: 1 })).toEqual({
        priority: { eq: 1 },
      })
    })

    it("expands number shorthand for all number fields", () => {
      const input: JobWhereInput = {
        priority: 1,
        attempts: 3,
        progress: 50,
        repeatCount: 5,
      }

      expect(normalizeWhere(input)).toEqual({
        priority: { eq: 1 },
        attempts: { eq: 3 },
        progress: { eq: 50 },
        repeatCount: { eq: 5 },
      })
    })

    it("passes through full IntFilter unchanged", () => {
      const input: JobWhereInput = { priority: { lte: 3 } }

      expect(normalizeWhere(input)).toEqual({
        priority: { lte: 3 },
      })
    })
  })

  describe("date and null filters", () => {
    it("passes through DateTimeFilter unchanged", () => {
      const input: JobWhereInput = {
        createdAt: { gte: "2024-01-01T00:00:00Z" },
      }

      expect(normalizeWhere(input)).toEqual({
        createdAt: { gte: "2024-01-01T00:00:00Z" },
      })
    })

    it("passes through NullFilter unchanged", () => {
      const input: JobWhereInput = { cron: { isNull: true } }

      expect(normalizeWhere(input)).toEqual({
        cron: { isNull: true },
      })
    })
  })

  describe("parentId field", () => {
    it("handles parentId string shorthand", () => {
      expect(normalizeWhere({ parentId: "abc" })).toEqual({
        parentId: { eq: "abc" },
      })
    })

    it("handles parentId NullFilter", () => {
      const input: JobWhereInput = { parentId: { isNull: true } }

      expect(normalizeWhere(input)).toEqual({
        parentId: { isNull: true },
      })
    })
  })

  describe("AND/OR normalization", () => {
    it("recursively normalizes AND array", () => {
      const input: JobWhereInput = {
        AND: [{ name: "send-email" }, { status: "pending" }],
      }

      expect(normalizeWhere(input)).toEqual({
        AND: [{ name: { eq: "send-email" } }, { status: { eq: "pending" } }],
      })
    })

    it("recursively normalizes OR array", () => {
      const input: JobWhereInput = {
        OR: [{ status: "failed" }, { status: "dead" }],
      }

      expect(normalizeWhere(input)).toEqual({
        OR: [{ status: { eq: "failed" } }, { status: { eq: "dead" } }],
      })
    })

    it("handles nested AND/OR with shorthands", () => {
      const input: JobWhereInput = {
        AND: [
          { priority: 1 },
          { OR: [{ status: "pending" }, { status: "delayed" }] },
        ],
      }

      expect(normalizeWhere(input)).toEqual({
        AND: [
          { priority: { eq: 1 } },
          {
            OR: [{ status: { eq: "pending" } }, { status: { eq: "delayed" } }],
          },
        ],
      })
    })
  })

  describe("complex combined filters", () => {
    it("handles complex combined filter with multiple fields", () => {
      const input: JobWhereInput = {
        name: "send-email",
        status: { in: ["pending", "failed"] },
        priority: { lte: 3 },
        createdAt: { gte: "2024-01-01T00:00:00Z" },
        OR: [{ groupKey: "group-a" }, { groupKey: "group-b" }],
      }

      expect(normalizeWhere(input)).toEqual({
        name: { eq: "send-email" },
        status: { in: ["pending", "failed"] },
        priority: { lte: 3 },
        createdAt: { gte: "2024-01-01T00:00:00Z" },
        OR: [{ groupKey: { eq: "group-a" } }, { groupKey: { eq: "group-b" } }],
      })
    })
  })

  describe("immutability", () => {
    it("does not mutate the original input", () => {
      const input: JobWhereInput = {
        name: "send-email",
        priority: 1,
        AND: [{ status: "pending" }],
      }

      const frozen = structuredClone(input)
      normalizeWhere(input)

      expect(input).toEqual(frozen)
    })
  })
})
