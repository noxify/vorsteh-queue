import { integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"

import { buildWhere } from "~/drizzle"
import type { NormalizedJobWhereInput } from "~/types"

const testTable = pgTable("test_jobs", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  priority: integer("priority").notNull(),
  attempts: integer("attempts").notNull(),
  progress: integer("progress").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  processAt: timestamp("process_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
  cron: varchar("cron", { length: 255 }),
  repeatCount: integer("repeat_count").notNull(),
  timeout: integer("timeout"),
  groupKey: varchar("group_key", { length: 255 }),
  uniqueKey: varchar("unique_key", { length: 255 }),
  flowId: uuid("flow_id"),
  parentId: uuid("parent_id"),
})

describe("buildWhere (Drizzle)", () => {
  describe("empty input", () => {
    it("returns undefined for empty where input", () => {
      const result = buildWhere({}, testTable)
      expect(result).toBeUndefined()
    })
  })

  describe("string filters", () => {
    it("generates SQL for string eq filter", () => {
      const where: NormalizedJobWhereInput = { name: { eq: "send-email" } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for string contains filter", () => {
      const where: NormalizedJobWhereInput = { name: { contains: "email" } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for string startsWith filter", () => {
      const where: NormalizedJobWhereInput = { name: { startsWith: "send" } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for string in filter", () => {
      const where: NormalizedJobWhereInput = {
        name: { in: ["send-email", "send-sms"] },
      }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })
  })

  describe("status filters", () => {
    it("generates SQL for status eq filter", () => {
      const where: NormalizedJobWhereInput = { status: { eq: "pending" } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for status in filter", () => {
      const where: NormalizedJobWhereInput = {
        status: { in: ["pending", "failed"] },
      }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })
  })

  describe("int filters", () => {
    it("generates SQL for int lt filter", () => {
      const where: NormalizedJobWhereInput = { priority: { lt: 5 } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for int gte filter", () => {
      const where: NormalizedJobWhereInput = { attempts: { gte: 3 } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })
  })

  describe("datetime filters", () => {
    it("generates SQL for datetime gte filter with Date", () => {
      const where: NormalizedJobWhereInput = {
        createdAt: { gte: new Date("2024-01-01T00:00:00Z") },
      }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for datetime lt filter with ISO string", () => {
      const where: NormalizedJobWhereInput = {
        processAt: { lt: "2024-12-31T23:59:59Z" },
      }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })
  })

  describe("isNull filters", () => {
    it("generates SQL for isNull true", () => {
      const where: NormalizedJobWhereInput = { cron: { isNull: true } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for isNull false", () => {
      const where: NormalizedJobWhereInput = { timeout: { isNull: false } }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })
  })

  describe("AND/OR recursion", () => {
    it("generates SQL for AND recursion", () => {
      const where: NormalizedJobWhereInput = {
        AND: [{ status: { eq: "pending" } }, { priority: { lte: 3 } }],
      }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })

    it("generates SQL for OR recursion", () => {
      const where: NormalizedJobWhereInput = {
        OR: [{ status: { eq: "failed" } }, { status: { eq: "dead" } }],
      }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })
  })

  describe("multiple fields", () => {
    it("combines multiple fields with AND", () => {
      const where: NormalizedJobWhereInput = {
        status: { eq: "pending" },
        name: { contains: "email" },
        priority: { lte: 3 },
      }
      const result = buildWhere(where, testTable)
      expect(result).toBeDefined()
    })
  })
})
