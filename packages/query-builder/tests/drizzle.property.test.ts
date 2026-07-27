import * as fc from "fast-check"
import { describe, expect, it } from "vitest"

import { buildWhere } from "~/drizzle"
import type {
  DateTimeFilter,
  IntFilter,
  JobStatus,
  JobStatusFilter,
  NormalizedJobWhereInput,
  NullFilter,
  StringFilter,
} from "~/types"

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const JOB_STATUSES: readonly JobStatus[] = [
  "pending",
  "delayed",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "dead",
  "waiting-children",
]

const arbJobStatus: fc.Arbitrary<JobStatus> = fc.constantFrom(...JOB_STATUSES)

const arbStringFilter: fc.Arbitrary<StringFilter> = fc
  .record(
    {
      eq: fc.string(),
      neq: fc.string(),
      contains: fc.string(),
      startsWith: fc.string(),
      like: fc.string(),
      in: fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
      isNull: fc.boolean(),
    },
    { requiredKeys: [] }
  )
  .filter((f) => Object.keys(f).length > 0)

const arbIntFilter: fc.Arbitrary<IntFilter> = fc
  .record(
    {
      eq: fc.integer(),
      neq: fc.integer(),
      lt: fc.integer(),
      lte: fc.integer(),
      gt: fc.integer(),
      gte: fc.integer(),
      isNull: fc.boolean(),
    },
    { requiredKeys: [] }
  )
  .filter((f) => Object.keys(f).length > 0)

const arbDateTimeFilter: fc.Arbitrary<DateTimeFilter> = fc
  .record(
    {
      lt: fc.date({ min: new Date("2000-01-01"), max: new Date("2030-01-01") }),
      lte: fc.date({
        min: new Date("2000-01-01"),
        max: new Date("2030-01-01"),
      }),
      gt: fc.date({ min: new Date("2000-01-01"), max: new Date("2030-01-01") }),
      gte: fc.date({
        min: new Date("2000-01-01"),
        max: new Date("2030-01-01"),
      }),
      isNull: fc.boolean(),
    },
    { requiredKeys: [] }
  )
  .filter((f) => Object.keys(f).length > 0)

const arbJobStatusFilter: fc.Arbitrary<JobStatusFilter> = fc
  .record(
    {
      eq: arbJobStatus,
      neq: arbJobStatus,
      in: fc.array(arbJobStatus, { minLength: 1, maxLength: 4 }),
    },
    { requiredKeys: [] }
  )
  .filter((f) => Object.keys(f).length > 0)

const arbNullFilter: fc.Arbitrary<NullFilter> = fc.record({
  isNull: fc.boolean(),
})

const STRING_FIELDS = ["id", "name", "uniqueKey", "groupKey", "flowId"] as const
const INT_FIELDS = ["priority", "attempts", "progress", "repeatCount"] as const
const DATETIME_FIELDS = [
  "createdAt",
  "processAt",
  "processedAt",
  "completedAt",
  "failedAt",
  "cancelledAt",
] as const
const NULL_FIELDS = ["cron", "timeout"] as const

function arbNormalizedInput(
  maxDepth: number
): fc.Arbitrary<NormalizedJobWhereInput> {
  const fieldArbs: Record<string, fc.Arbitrary<unknown>> = {}

  for (const f of STRING_FIELDS) {
    fieldArbs[f] = arbStringFilter
  }
  fieldArbs.parentId = fc.oneof(arbStringFilter, arbNullFilter)
  fieldArbs.status = arbJobStatusFilter
  for (const f of INT_FIELDS) {
    fieldArbs[f] = arbIntFilter
  }
  for (const f of DATETIME_FIELDS) {
    fieldArbs[f] = arbDateTimeFilter
  }
  for (const f of NULL_FIELDS) {
    fieldArbs[f] = arbNullFilter
  }

  const baseArb = fc
    .record(fieldArbs as Record<string, fc.Arbitrary<unknown>>, {
      requiredKeys: [],
    })
    .filter(
      (r) => Object.keys(r).length > 0
    ) as fc.Arbitrary<NormalizedJobWhereInput>

  if (maxDepth <= 0) {
    return baseArb
  }

  return fc.oneof(
    { weight: 3, arbitrary: baseArb },
    {
      weight: 1,
      arbitrary: fc.record(
        {
          AND: fc.array(arbNormalizedInput(maxDepth - 1), {
            minLength: 1,
            maxLength: 3,
          }),
        },
        { requiredKeys: ["AND"] }
      ) as fc.Arbitrary<NormalizedJobWhereInput>,
    },
    {
      weight: 1,
      arbitrary: fc.record(
        {
          OR: fc.array(arbNormalizedInput(maxDepth - 1), {
            minLength: 1,
            maxLength: 3,
          }),
        },
        { requiredKeys: ["OR"] }
      ) as fc.Arbitrary<NormalizedJobWhereInput>,
    }
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expectedStringOperators(
  filter: StringFilter
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (filter.eq !== undefined) {
    result.eq = filter.eq
  }
  if (filter.neq !== undefined) {
    result.ne = filter.neq
  }
  if (filter.contains !== undefined) {
    result.like = `%${filter.contains}%`
  }
  if (filter.startsWith !== undefined) {
    result.like = `${filter.startsWith}%`
  }
  if (filter.like !== undefined) {
    result.like = filter.like
  }
  if (filter.in !== undefined) {
    result.in = [...filter.in]
  }
  if (filter.isNull === true) {
    result.isNull = true
  }
  if (filter.isNull === false) {
    result.isNotNull = true
  }
  return result
}

function expectedIntOperators(filter: IntFilter): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (filter.eq !== undefined) {
    result.eq = filter.eq
  }
  if (filter.neq !== undefined) {
    result.ne = filter.neq
  }
  if (filter.lt !== undefined) {
    result.lt = filter.lt
  }
  if (filter.lte !== undefined) {
    result.lte = filter.lte
  }
  if (filter.gt !== undefined) {
    result.gt = filter.gt
  }
  if (filter.gte !== undefined) {
    result.gte = filter.gte
  }
  if (filter.isNull === true) {
    result.isNull = true
  }
  if (filter.isNull === false) {
    result.isNotNull = true
  }
  return result
}

function expectedDateTimeOperators(
  filter: DateTimeFilter
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (filter.lt !== undefined) {
    result.lt = filter.lt instanceof Date ? filter.lt : new Date(filter.lt)
  }
  if (filter.lte !== undefined) {
    result.lte = filter.lte instanceof Date ? filter.lte : new Date(filter.lte)
  }
  if (filter.gt !== undefined) {
    result.gt = filter.gt instanceof Date ? filter.gt : new Date(filter.gt)
  }
  if (filter.gte !== undefined) {
    result.gte = filter.gte instanceof Date ? filter.gte : new Date(filter.gte)
  }
  if (filter.isNull === true) {
    result.isNull = true
  }
  if (filter.isNull === false) {
    result.isNotNull = true
  }
  return result
}

function expectedStatusOperators(
  filter: JobStatusFilter
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  if (filter.eq !== undefined) {
    result.eq = filter.eq
  }
  if (filter.neq !== undefined) {
    result.ne = filter.neq
  }
  if (filter.in !== undefined) {
    result.in = [...filter.in]
  }
  return result
}

function expectedNullOperator(filter: NullFilter): Record<string, unknown> {
  if (filter.isNull === true) {
    return { isNull: true }
  }
  if (filter.isNull === false) {
    return { isNotNull: true }
  }
  return {}
}

function isStringFilterLike(
  filter: StringFilter | NullFilter
): filter is StringFilter {
  return (
    "eq" in filter ||
    "neq" in filter ||
    "in" in filter ||
    "contains" in filter ||
    "startsWith" in filter ||
    "like" in filter
  )
}

function hasStringFilterOperators(filter: StringFilter): boolean {
  return (
    filter.eq !== undefined ||
    filter.neq !== undefined ||
    filter.contains !== undefined ||
    filter.startsWith !== undefined ||
    filter.like !== undefined ||
    filter.in !== undefined ||
    filter.isNull !== undefined
  )
}

function hasIntFilterOperators(filter: IntFilter): boolean {
  return (
    filter.eq !== undefined ||
    filter.neq !== undefined ||
    filter.lt !== undefined ||
    filter.lte !== undefined ||
    filter.gt !== undefined ||
    filter.gte !== undefined ||
    filter.isNull !== undefined
  )
}

function hasDateTimeFilterOperators(filter: DateTimeFilter): boolean {
  return (
    filter.lt !== undefined ||
    filter.lte !== undefined ||
    filter.gt !== undefined ||
    filter.gte !== undefined ||
    filter.isNull !== undefined
  )
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe("Feature: drizzle-v1-migration, Property 1: buildWhere round-trip operator equivalence", () => {
  /**
   * **Validates: Requirements 12.1, 4.1, 3.3**
   *
   * For any valid NormalizedJobWhereInput, each input operator maps to exactly
   * one corresponding RQB v2 operator, and no information is lost or added.
   */
  it("maps every input operator to the correct RQB v2 operator", () => {
    fc.assert(
      fc.property(arbNormalizedInput(2), (input) => {
        const result = buildWhere(input)

        for (const field of STRING_FIELDS) {
          const filter = input[field]
          if (filter) {
            const expected = expectedStringOperators(filter)
            if (Object.keys(expected).length > 0) {
              expect(result[field]).toStrictEqual(expected)
            }
          }
        }

        if (input.parentId) {
          const parentFilter = input.parentId
          const expected = isStringFilterLike(parentFilter)
            ? expectedStringOperators(parentFilter as StringFilter)
            : expectedNullOperator(parentFilter as NullFilter)
          if (Object.keys(expected).length > 0) {
            expect(result.parentId).toStrictEqual(expected)
          }
        }

        if (input.status) {
          const expected = expectedStatusOperators(input.status)
          if (Object.keys(expected).length > 0) {
            expect(result.status).toStrictEqual(expected)
          }
        }

        for (const field of INT_FIELDS) {
          const filter = input[field]
          if (filter) {
            const expected = expectedIntOperators(filter)
            if (Object.keys(expected).length > 0) {
              expect(result[field]).toStrictEqual(expected)
            }
          }
        }

        for (const field of DATETIME_FIELDS) {
          const filter = input[field]
          if (filter) {
            const expected = expectedDateTimeOperators(filter)
            if (Object.keys(expected).length > 0) {
              expect(result[field]).toStrictEqual(expected)
            }
          }
        }

        for (const field of NULL_FIELDS) {
          const filter = input[field]
          if (filter) {
            const expected = expectedNullOperator(filter)
            if (Object.keys(expected).length > 0) {
              expect(result[field]).toStrictEqual(expected)
            }
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})

describe("Feature: drizzle-v1-migration, Property 2: Empty input produces empty object", () => {
  /**
   * **Validates: Requirements 12.2**
   *
   * When buildWhere is called with a NormalizedJobWhereInput where no fields are
   * set and no AND/OR arrays are present, the result is an empty object.
   */
  it("returns {} for empty input", () => {
    fc.assert(
      fc.property(fc.constant({} as NormalizedJobWhereInput), (input) => {
        const result = buildWhere(input)
        expect(result).toStrictEqual({})
      }),
      { numRuns: 100 }
    )
  })
})

describe("Feature: drizzle-v1-migration, Property 3: Logical operator structural preservation", () => {
  /**
   * **Validates: Requirements 12.3, 4.2, 4.3**
   *
   * For any NormalizedJobWhereInput containing nested AND and/or OR arrays at
   * any depth, the resulting where object contains AND/OR arrays at the same
   * positions, each element being a recursively valid where object.
   */
  it("preserves AND/OR array lengths and recursive structure", () => {
    const arbWithLogical = fc.oneof(
      fc.record(
        {
          AND: fc.array(arbNormalizedInput(2), { minLength: 0, maxLength: 4 }),
        },
        { requiredKeys: ["AND"] }
      ),
      fc.record(
        {
          OR: fc.array(arbNormalizedInput(2), { minLength: 0, maxLength: 4 }),
        },
        { requiredKeys: ["OR"] }
      ),
      fc.record(
        {
          AND: fc.array(arbNormalizedInput(1), { minLength: 1, maxLength: 3 }),
          OR: fc.array(arbNormalizedInput(1), { minLength: 1, maxLength: 3 }),
        },
        { requiredKeys: ["AND", "OR"] }
      )
    ) as fc.Arbitrary<NormalizedJobWhereInput>

    fc.assert(
      fc.property(arbWithLogical, (input) => {
        const result = buildWhere(input)
        verifyLogicalOperator(input, result, "AND")
        verifyLogicalOperator(input, result, "OR")
      }),
      { numRuns: 100 }
    )
  })
})

function verifyLogicalOperator(
  input: NormalizedJobWhereInput,
  result: Record<string, unknown>,
  op: "AND" | "OR"
): void {
  const inputArray = input[op]
  if (!inputArray) {
    return
  }

  expect(result[op]).toBeDefined()
  const resultArray = result[op] as Record<string, unknown>[]
  expect(resultArray).toHaveLength(inputArray.length)

  for (let i = 0; i < inputArray.length; i++) {
    const nestedResult = resultArray[i]
    expect(typeof nestedResult).toBe("object")
    expect(nestedResult).not.toBeNull()

    const nestedInput = inputArray[i]
    if (nestedInput?.AND) {
      const nestedObj = nestedResult as Record<string, unknown>
      expect(nestedObj.AND).toBeDefined()
      expect((nestedObj.AND as unknown[]).length).toBe(nestedInput.AND.length)
    }
    if (nestedInput?.OR) {
      const nestedObj = nestedResult as Record<string, unknown>
      expect(nestedObj.OR).toBeDefined()
      expect((nestedObj.OR as unknown[]).length).toBe(nestedInput.OR.length)
    }
  }
}

describe("Feature: drizzle-v1-migration, Property 4: Filter operator mapping completeness", () => {
  /**
   * **Validates: Requirements 4.4, 4.5, 4.6**
   *
   * For any NormalizedJobWhereInput containing field filters for all field types,
   * each operator in the input has a corresponding key in the output object.
   */
  it("every field filter in input produces a corresponding key in output", () => {
    fc.assert(
      fc.property(arbNormalizedInput(1), (input) => {
        const result = buildWhere(input)
        verifyStringFieldsPresent(input, result)
        verifyParentIdPresent(input, result)
        verifyStatusPresent(input, result)
        verifyIntFieldsPresent(input, result)
        verifyDateTimeFieldsPresent(input, result)
        verifyNullFieldsPresent(input, result)
      }),
      { numRuns: 100 }
    )
  })
})

function verifyStringFieldsPresent(
  input: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  for (const field of STRING_FIELDS) {
    const filter = input[field]
    if (filter && hasStringFilterOperators(filter)) {
      expect(result).toHaveProperty(field)
    }
  }
}

function verifyParentIdPresent(
  input: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  if (!input.parentId) {
    return
  }
  const parentFilter = input.parentId
  const hasOps =
    "eq" in parentFilter ||
    "neq" in parentFilter ||
    "contains" in parentFilter ||
    "startsWith" in parentFilter ||
    "like" in parentFilter ||
    "in" in parentFilter ||
    "isNull" in parentFilter
  if (hasOps) {
    expect(result).toHaveProperty("parentId")
  }
}

function verifyStatusPresent(
  input: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  if (!input.status) {
    return
  }
  const filter = input.status
  const hasOps =
    filter.eq !== undefined ||
    filter.neq !== undefined ||
    filter.in !== undefined
  if (hasOps) {
    expect(result).toHaveProperty("status")
  }
}

function verifyIntFieldsPresent(
  input: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  for (const field of INT_FIELDS) {
    const filter = input[field]
    if (filter && hasIntFilterOperators(filter)) {
      expect(result).toHaveProperty(field)
    }
  }
}

function verifyDateTimeFieldsPresent(
  input: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  for (const field of DATETIME_FIELDS) {
    const filter = input[field]
    if (filter && hasDateTimeFilterOperators(filter)) {
      expect(result).toHaveProperty(field)
    }
  }
}

function verifyNullFieldsPresent(
  input: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  for (const field of NULL_FIELDS) {
    const filter = input[field]
    if (filter && filter.isNull !== undefined) {
      expect(result).toHaveProperty(field)
    }
  }
}
