import type {
  JobWhereInput,
  NormalizedJobWhereInput,
  NullFilter,
  StringFilter,
} from "./types"

/** String fields that accept a shorthand string value */
const STRING_FIELDS = ["id", "name", "uniqueKey", "groupKey", "flowId"] as const

/** Number fields that accept a shorthand number value */
const NUMBER_FIELDS = [
  "priority",
  "attempts",
  "progress",
  "repeatCount",
] as const

/** Expand string field shorthands into the result object */
function expandStringFields(
  where: JobWhereInput,
  result: Record<string, unknown>
): void {
  for (const field of STRING_FIELDS) {
    const value = where[field]
    if (value === undefined) {
      continue
    }
    result[field] = typeof value === "string" ? { eq: value } : value
  }
}

/** Expand number field shorthands into the result object */
function expandNumberFields(
  where: JobWhereInput,
  result: Record<string, unknown>
): void {
  for (const field of NUMBER_FIELDS) {
    const value = where[field]
    if (value === undefined) {
      continue
    }
    result[field] = typeof value === "number" ? { eq: value } : value
  }
}

/** Copy timestamp filters (no shorthand expansion needed) */
function copyTimestampFields(
  where: JobWhereInput,
  result: Record<string, unknown>
): void {
  if (where.createdAt !== undefined) {
    result.createdAt = where.createdAt
  }
  if (where.processAt !== undefined) {
    result.processAt = where.processAt
  }
  if (where.processedAt !== undefined) {
    result.processedAt = where.processedAt
  }
  if (where.completedAt !== undefined) {
    result.completedAt = where.completedAt
  }
  if (where.failedAt !== undefined) {
    result.failedAt = where.failedAt
  }
  if (where.cancelledAt !== undefined) {
    result.cancelledAt = where.cancelledAt
  }
}

/**
 * Normalize a `JobWhereInput` by expanding scalar shorthands to their full filter object form.
 *
 * - String fields: `"value"` → `{ eq: "value" }`
 * - Status field: `"pending"` → `{ eq: "pending" }`
 * - Number fields: `42` → `{ eq: 42 }`
 * - `AND` / `OR` arrays are recursively normalized
 * - Already-expanded filter objects pass through unchanged
 *
 * @param where - The raw filter input (may contain shorthands), or undefined
 * @returns A normalized filter with all shorthands expanded to full filter objects
 *
 * @example
 * ```typescript
 * normalizeWhere({ status: "pending", name: "send-email" })
 * // → { status: { eq: "pending" }, name: { eq: "send-email" } }
 *
 * normalizeWhere({ priority: 1, OR: [{ status: "failed" }, { status: "dead" }] })
 * // → { priority: { eq: 1 }, OR: [{ status: { eq: "failed" } }, { status: { eq: "dead" } }] }
 * ```
 */
export function normalizeWhere(
  where?: JobWhereInput | undefined
): NormalizedJobWhereInput {
  if (!where) {
    return {}
  }

  const result: Record<string, unknown> = {}

  // Normalize AND/OR arrays recursively
  if (where.AND) {
    result.AND = where.AND.map((clause) => normalizeWhere(clause))
  }
  if (where.OR) {
    result.OR = where.OR.map((clause) => normalizeWhere(clause))
  }

  // Expand shorthands by field type
  expandStringFields(where, result)
  expandNumberFields(where, result)

  // Expand status shorthand
  if (where.status !== undefined) {
    result.status =
      typeof where.status === "string" ? { eq: where.status } : where.status
  }

  // Copy timestamp and null-only filters
  copyTimestampFields(where, result)
  if (where.cron !== undefined) {
    result.cron = where.cron
  }
  if (where.timeout !== undefined) {
    result.timeout = where.timeout
  }

  // Handle parentId (string | StringFilter | NullFilter)
  if (where.parentId !== undefined) {
    result.parentId =
      typeof where.parentId === "string"
        ? ({ eq: where.parentId } satisfies StringFilter)
        : (where.parentId as StringFilter | NullFilter)
  }

  return result as NormalizedJobWhereInput
}
