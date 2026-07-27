import { describe, expect, it } from "vitest"

import { matchesWhere } from "~/match"
import type { NormalizedJobWhereInput } from "~/types"

const baseJob = {
  id: "job-1",
  name: "send-email",
  status: "pending",
  priority: 2,
  attempts: 0,
  progress: 0,
  createdAt: new Date("2024-06-01T12:00:00Z"),
  processAt: new Date("2024-06-01T12:00:00Z"),
  processedAt: undefined,
  completedAt: undefined,
  failedAt: undefined,
  cancelledAt: undefined,
  cron: undefined,
  repeatCount: 0,
  timeout: 30_000,
  groupKey: "group-a",
  uniqueKey: "unique-1",
  flowId: undefined,
  parentId: undefined,
}

describe("matchesWhere", () => {
  describe("StringFilter operators", () => {
    it("eq matches when value equals", () => {
      expect(matchesWhere(baseJob, { name: { eq: "send-email" } })).toBe(true)
    })

    it("eq does not match when value differs", () => {
      expect(matchesWhere(baseJob, { name: { eq: "send-sms" } })).toBe(false)
    })

    it("neq matches when value differs", () => {
      expect(matchesWhere(baseJob, { name: { neq: "send-sms" } })).toBe(true)
    })

    it("neq does not match when value equals", () => {
      expect(matchesWhere(baseJob, { name: { neq: "send-email" } })).toBe(false)
    })

    it("contains matches substring", () => {
      expect(matchesWhere(baseJob, { name: { contains: "email" } })).toBe(true)
    })

    it("contains does not match when substring absent", () => {
      expect(matchesWhere(baseJob, { name: { contains: "sms" } })).toBe(false)
    })

    it("startsWith matches prefix", () => {
      expect(matchesWhere(baseJob, { name: { startsWith: "send" } })).toBe(true)
    })

    it("startsWith does not match non-prefix", () => {
      expect(matchesWhere(baseJob, { name: { startsWith: "email" } })).toBe(
        false
      )
    })

    it("like matches with % wildcards", () => {
      expect(matchesWhere(baseJob, { name: { like: "send-%" } })).toBe(true)
      expect(matchesWhere(baseJob, { name: { like: "%email" } })).toBe(true)
      expect(matchesWhere(baseJob, { name: { like: "%d-e%" } })).toBe(true)
    })

    it("like matches with _ wildcard", () => {
      expect(matchesWhere(baseJob, { name: { like: "send-emai_" } })).toBe(true)
    })

    it("like does not match when pattern fails", () => {
      expect(matchesWhere(baseJob, { name: { like: "sms-%" } })).toBe(false)
    })

    it("in matches one of the values", () => {
      expect(
        matchesWhere(baseJob, { name: { in: ["send-email", "send-sms"] } })
      ).toBe(true)
    })

    it("in does not match when value not in list", () => {
      expect(
        matchesWhere(baseJob, { name: { in: ["send-sms", "send-push"] } })
      ).toBe(false)
    })

    it("isNull true matches null/undefined field", () => {
      expect(matchesWhere(baseJob, { flowId: { isNull: true } })).toBe(true)
    })

    it("isNull false matches non-null field", () => {
      expect(matchesWhere(baseJob, { name: { isNull: false } })).toBe(true)
    })
  })

  describe("IntFilter operators", () => {
    it("eq matches equal number", () => {
      expect(matchesWhere(baseJob, { priority: { eq: 2 } })).toBe(true)
    })

    it("eq does not match different number", () => {
      expect(matchesWhere(baseJob, { priority: { eq: 3 } })).toBe(false)
    })

    it("neq matches different number", () => {
      expect(matchesWhere(baseJob, { priority: { neq: 3 } })).toBe(true)
    })

    it("neq does not match equal number", () => {
      expect(matchesWhere(baseJob, { priority: { neq: 2 } })).toBe(false)
    })

    it("lt matches when value is less", () => {
      expect(matchesWhere(baseJob, { priority: { lt: 5 } })).toBe(true)
    })

    it("lt does not match when value is equal or greater", () => {
      expect(matchesWhere(baseJob, { priority: { lt: 2 } })).toBe(false)
      expect(matchesWhere(baseJob, { priority: { lt: 1 } })).toBe(false)
    })

    it("lte matches when value is less or equal", () => {
      expect(matchesWhere(baseJob, { priority: { lte: 2 } })).toBe(true)
      expect(matchesWhere(baseJob, { priority: { lte: 5 } })).toBe(true)
    })

    it("lte does not match when value is greater", () => {
      expect(matchesWhere(baseJob, { priority: { lte: 1 } })).toBe(false)
    })

    it("gt matches when value is greater", () => {
      expect(matchesWhere(baseJob, { priority: { gt: 1 } })).toBe(true)
    })

    it("gt does not match when value is equal or less", () => {
      expect(matchesWhere(baseJob, { priority: { gt: 2 } })).toBe(false)
      expect(matchesWhere(baseJob, { priority: { gt: 5 } })).toBe(false)
    })

    it("gte matches when value is greater or equal", () => {
      expect(matchesWhere(baseJob, { priority: { gte: 2 } })).toBe(true)
      expect(matchesWhere(baseJob, { priority: { gte: 1 } })).toBe(true)
    })

    it("gte does not match when value is less", () => {
      expect(matchesWhere(baseJob, { priority: { gte: 3 } })).toBe(false)
    })

    it("isNull true matches undefined number field", () => {
      const job = { ...baseJob, timeout: undefined }
      // timeout is handled via NullFilter but testing via IntFilter on a nullable field:
      // using attempts field with undefined value for this test
      expect(matchesWhere(job, { timeout: { isNull: true } })).toBe(true)
    })

    it("isNull false matches defined number field", () => {
      expect(matchesWhere(baseJob, { timeout: { isNull: false } })).toBe(true)
    })
  })

  describe("DateTimeFilter operators", () => {
    it("lt matches when date is before", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { lt: new Date("2024-06-02T00:00:00Z") },
        })
      ).toBe(true)
    })

    it("lt does not match when date is after or equal", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { lt: new Date("2024-06-01T12:00:00Z") },
        })
      ).toBe(false)
    })

    it("lte matches when date is before or equal", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { lte: new Date("2024-06-01T12:00:00Z") },
        })
      ).toBe(true)
    })

    it("lte does not match when date is after", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { lte: new Date("2024-05-31T00:00:00Z") },
        })
      ).toBe(false)
    })

    it("gt matches when date is after", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { gt: new Date("2024-05-31T00:00:00Z") },
        })
      ).toBe(true)
    })

    it("gt does not match when date is before or equal", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { gt: new Date("2024-06-01T12:00:00Z") },
        })
      ).toBe(false)
    })

    it("gte matches when date is after or equal", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { gte: new Date("2024-06-01T12:00:00Z") },
        })
      ).toBe(true)
    })

    it("gte does not match when date is before", () => {
      expect(
        matchesWhere(baseJob, {
          createdAt: { gte: new Date("2024-06-02T00:00:00Z") },
        })
      ).toBe(false)
    })

    it("accepts ISO string for comparison", () => {
      expect(
        matchesWhere(baseJob, { createdAt: { gte: "2024-06-01T12:00:00Z" } })
      ).toBe(true)
      expect(
        matchesWhere(baseJob, { createdAt: { lt: "2024-06-02T00:00:00Z" } })
      ).toBe(true)
    })

    it("isNull true matches undefined date", () => {
      expect(matchesWhere(baseJob, { processedAt: { isNull: true } })).toBe(
        true
      )
    })

    it("isNull false matches defined date", () => {
      expect(matchesWhere(baseJob, { createdAt: { isNull: false } })).toBe(true)
    })
  })

  describe("JobStatusFilter operators", () => {
    it("eq matches same status", () => {
      expect(matchesWhere(baseJob, { status: { eq: "pending" } })).toBe(true)
    })

    it("eq does not match different status", () => {
      expect(matchesWhere(baseJob, { status: { eq: "completed" } })).toBe(false)
    })

    it("neq matches different status", () => {
      expect(matchesWhere(baseJob, { status: { neq: "failed" } })).toBe(true)
    })

    it("neq does not match same status", () => {
      expect(matchesWhere(baseJob, { status: { neq: "pending" } })).toBe(false)
    })

    it("in matches when status in list", () => {
      expect(
        matchesWhere(baseJob, { status: { in: ["pending", "delayed"] } })
      ).toBe(true)
    })

    it("in does not match when status not in list", () => {
      expect(
        matchesWhere(baseJob, { status: { in: ["completed", "failed"] } })
      ).toBe(false)
    })
  })

  describe("NullFilter operators", () => {
    it("cron isNull true matches when undefined", () => {
      expect(matchesWhere(baseJob, { cron: { isNull: true } })).toBe(true)
    })

    it("cron isNull false does not match when undefined", () => {
      expect(matchesWhere(baseJob, { cron: { isNull: false } })).toBe(false)
    })

    it("timeout isNull false matches when timeout is defined", () => {
      expect(matchesWhere(baseJob, { timeout: { isNull: false } })).toBe(true)
    })

    it("timeout isNull true does not match when timeout is defined", () => {
      expect(matchesWhere(baseJob, { timeout: { isNull: true } })).toBe(false)
    })

    it("timeout isNull true matches when timeout is undefined", () => {
      const job = { ...baseJob, timeout: undefined }
      expect(matchesWhere(job, { timeout: { isNull: true } })).toBe(true)
    })
  })

  describe("AND logic", () => {
    it("matches when all conditions are true", () => {
      const where: NormalizedJobWhereInput = {
        AND: [
          { status: { eq: "pending" } },
          { name: { contains: "email" } },
          { priority: { lte: 5 } },
        ],
      }
      expect(matchesWhere(baseJob, where)).toBe(true)
    })

    it("does not match when one condition fails", () => {
      const where: NormalizedJobWhereInput = {
        AND: [
          { status: { eq: "pending" } },
          { name: { contains: "sms" } },
          { priority: { lte: 5 } },
        ],
      }
      expect(matchesWhere(baseJob, where)).toBe(false)
    })
  })

  describe("OR logic", () => {
    it("matches when at least one condition is true", () => {
      const where: NormalizedJobWhereInput = {
        OR: [{ status: { eq: "completed" } }, { name: { contains: "email" } }],
      }
      expect(matchesWhere(baseJob, where)).toBe(true)
    })

    it("does not match when no conditions are true", () => {
      const where: NormalizedJobWhereInput = {
        OR: [{ status: { eq: "completed" } }, { name: { contains: "sms" } }],
      }
      expect(matchesWhere(baseJob, where)).toBe(false)
    })
  })

  describe("complex nested AND/OR", () => {
    it("matches nested AND containing OR", () => {
      const where: NormalizedJobWhereInput = {
        AND: [
          { status: { eq: "pending" } },
          {
            OR: [
              { name: { contains: "email" } },
              { name: { contains: "sms" } },
            ],
          },
        ],
      }
      expect(matchesWhere(baseJob, where)).toBe(true)
    })

    it("does not match when outer AND fails", () => {
      const where: NormalizedJobWhereInput = {
        AND: [
          { status: { eq: "completed" } },
          {
            OR: [
              { name: { contains: "email" } },
              { name: { contains: "sms" } },
            ],
          },
        ],
      }
      expect(matchesWhere(baseJob, where)).toBe(false)
    })

    it("does not match when inner OR fails", () => {
      const where: NormalizedJobWhereInput = {
        AND: [
          { status: { eq: "pending" } },
          {
            OR: [{ name: { contains: "push" } }, { name: { contains: "sms" } }],
          },
        ],
      }
      expect(matchesWhere(baseJob, where)).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("empty where matches everything", () => {
      expect(matchesWhere(baseJob, {})).toBe(true)
    })

    it("multiple operators on same field all apply", () => {
      expect(matchesWhere(baseJob, { priority: { gte: 1, lte: 5 } })).toBe(true)
      expect(matchesWhere(baseJob, { priority: { gte: 3, lte: 5 } })).toBe(
        false
      )
    })

    it("parentId as StringFilter", () => {
      const job = { ...baseJob, parentId: "parent-1" }
      expect(matchesWhere(job, { parentId: { eq: "parent-1" } })).toBe(true)
      expect(matchesWhere(job, { parentId: { eq: "parent-2" } })).toBe(false)
    })

    it("parentId as NullFilter isNull true matches undefined parentId", () => {
      expect(matchesWhere(baseJob, { parentId: { isNull: true } })).toBe(true)
    })

    it("parentId as NullFilter isNull false does not match undefined parentId", () => {
      expect(matchesWhere(baseJob, { parentId: { isNull: false } })).toBe(false)
    })
  })
})
