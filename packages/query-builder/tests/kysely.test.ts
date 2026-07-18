import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely"
import { describe, expect, it } from "vitest"

import { buildWhere } from "~/kysely"
import type { NormalizedJobWhereInput } from "~/types"

interface TestDB {
  queue_jobs: {
    id: string
    name: string
    status: string
    priority: number
    attempts: number
    progress: number
    created_at: Date
    process_at: Date
    processed_at: Date | null
    completed_at: Date | null
    failed_at: Date | null
    cancelled_at: Date | null
    cron: string | null
    repeat_count: number
    timeout: number | null
    group_key: string | null
    unique_key: string | null
    flow_id: string | null
    parent_id: string | null
  }
}

const db = new Kysely<TestDB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (instance) => new PostgresIntrospector(instance),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
})

function baseQuery() {
  return db.selectFrom("queue_jobs").selectAll()
}

describe("buildWhere (Kysely)", () => {
  describe("empty input", () => {
    it("returns unmodified query for empty where", () => {
      const query = baseQuery()
      const result = buildWhere(query, {})
      const compiled = result.compile()

      expect(compiled.sql).toBe('select * from "queue_jobs"')
    })
  })

  describe("string filters", () => {
    it("adds status eq condition to query", () => {
      const where: NormalizedJobWhereInput = { status: { eq: "pending" } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"status" = $1')
      expect(compiled.parameters).toContain("pending")
    })

    it("adds name contains condition (LIKE with %)", () => {
      const where: NormalizedJobWhereInput = { name: { contains: "email" } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"name" like $1')
      expect(compiled.parameters).toContain("%email%")
    })

    it("adds name startsWith condition", () => {
      const where: NormalizedJobWhereInput = { name: { startsWith: "send" } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"name" like $1')
      expect(compiled.parameters).toContain("send%")
    })

    it("adds name in condition", () => {
      const where: NormalizedJobWhereInput = {
        name: { in: ["send-email", "send-sms"] },
      }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"name" in ($1, $2)')
      expect(compiled.parameters).toContain("send-email")
      expect(compiled.parameters).toContain("send-sms")
    })
  })

  describe("int filters", () => {
    it("adds priority lt condition", () => {
      const where: NormalizedJobWhereInput = { priority: { lt: 5 } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"priority" < $1')
      expect(compiled.parameters).toContain(5)
    })

    it("adds priority gte condition", () => {
      const where: NormalizedJobWhereInput = { priority: { gte: 3 } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"priority" >= $1')
      expect(compiled.parameters).toContain(3)
    })
  })

  describe("datetime filters", () => {
    it("adds createdAt gte condition", () => {
      const date = new Date("2024-01-01T00:00:00Z")
      const where: NormalizedJobWhereInput = { createdAt: { gte: date } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"created_at" >= $1')
      expect(compiled.parameters).toContainEqual(date)
    })

    it("adds processAt lt condition with ISO string", () => {
      const where: NormalizedJobWhereInput = {
        processAt: { lt: "2024-12-31T23:59:59Z" },
      }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"process_at" < $1')
      expect(compiled.parameters).toContainEqual(
        new Date("2024-12-31T23:59:59Z")
      )
    })
  })

  describe("isNull filters", () => {
    it("adds isNull true condition", () => {
      const where: NormalizedJobWhereInput = { cron: { isNull: true } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"cron" is null')
    })

    it("adds isNull false condition", () => {
      const where: NormalizedJobWhereInput = { timeout: { isNull: false } }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"timeout" is not null')
    })
  })

  describe("AND/OR recursion", () => {
    it("handles AND recursion", () => {
      const where: NormalizedJobWhereInput = {
        AND: [{ status: { eq: "pending" } }, { priority: { lte: 3 } }],
      }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"status" = $1')
      expect(compiled.sql).toContain('"priority" <= $2')
      expect(compiled.parameters).toContain("pending")
      expect(compiled.parameters).toContain(3)
    })

    it("handles OR recursion", () => {
      const where: NormalizedJobWhereInput = {
        OR: [{ status: { eq: "failed" } }, { status: { eq: "dead" } }],
      }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"status" = $1')
      expect(compiled.sql).toContain('"status" = $2')
      expect(compiled.sql).toContain(" or ")
      expect(compiled.parameters).toContain("failed")
      expect(compiled.parameters).toContain("dead")
    })
  })

  describe("multiple fields", () => {
    it("combines multiple field conditions", () => {
      const where: NormalizedJobWhereInput = {
        status: { eq: "pending" },
        name: { contains: "email" },
        priority: { lte: 3 },
      }
      const result = buildWhere(baseQuery(), where)
      const compiled = result.compile()

      expect(compiled.sql).toContain('"name" like')
      expect(compiled.sql).toContain('"status" =')
      expect(compiled.sql).toContain('"priority" <=')
      expect(compiled.parameters).toContain("pending")
      expect(compiled.parameters).toContain("%email%")
      expect(compiled.parameters).toContain(3)
    })
  })
})
