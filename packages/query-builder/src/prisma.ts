import type {
  DateTimeFilter,
  IntFilter,
  JobStatusFilter,
  NormalizedJobWhereInput,
  NullFilter,
  StringFilter,
} from "./types"

// ─── Helper: Convert Date | string → Date ────────────────────────────────────

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

// ─── Helper: Parse LIKE pattern into Prisma-compatible filter ────────────────

function parseLikePattern(pattern: string): Record<string, string> {
  if (pattern.startsWith("%") && pattern.endsWith("%")) {
    return { contains: pattern.slice(1, -1) }
  }
  if (pattern.endsWith("%") && !pattern.startsWith("%")) {
    return { startsWith: pattern.slice(0, -1) }
  }
  // Best effort fallback: strip all % and use contains
  return { contains: pattern.replaceAll("%", "") }
}

// ─── Helper: StringFilter → Prisma conditions ────────────────────────────────

function buildStringConditions(
  filter: StringFilter
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = []

  if (filter.eq !== undefined) {
    conditions.push(filter.eq as unknown as Record<string, unknown>)
  }
  if (filter.neq !== undefined) {
    conditions.push({ not: filter.neq })
  }
  if (filter.contains !== undefined) {
    conditions.push({ contains: filter.contains })
  }
  if (filter.startsWith !== undefined) {
    conditions.push({ startsWith: filter.startsWith })
  }
  if (filter.like !== undefined) {
    conditions.push(parseLikePattern(filter.like))
  }
  if (filter.in !== undefined) {
    conditions.push({ in: [...filter.in] })
  }
  if (filter.isNull === true) {
    conditions.push(null as unknown as Record<string, unknown>)
  }
  if (filter.isNull === false) {
    conditions.push({ not: null })
  }

  return conditions
}

// ─── Helper: IntFilter → Prisma conditions ───────────────────────────────────

function buildIntConditions(filter: IntFilter): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = []

  if (filter.eq !== undefined) {
    conditions.push(filter.eq as unknown as Record<string, unknown>)
  }
  if (filter.neq !== undefined) {
    conditions.push({ not: filter.neq })
  }
  if (filter.lt !== undefined) {
    conditions.push({ lt: filter.lt })
  }
  if (filter.lte !== undefined) {
    conditions.push({ lte: filter.lte })
  }
  if (filter.gt !== undefined) {
    conditions.push({ gt: filter.gt })
  }
  if (filter.gte !== undefined) {
    conditions.push({ gte: filter.gte })
  }
  if (filter.isNull === true) {
    conditions.push(null as unknown as Record<string, unknown>)
  }
  if (filter.isNull === false) {
    conditions.push({ not: null })
  }

  return conditions
}

// ─── Helper: DateTimeFilter → Prisma conditions ──────────────────────────────

function buildDateTimeConditions(
  filter: DateTimeFilter
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = []

  if (filter.lt !== undefined) {
    conditions.push({ lt: toDate(filter.lt) })
  }
  if (filter.lte !== undefined) {
    conditions.push({ lte: toDate(filter.lte) })
  }
  if (filter.gt !== undefined) {
    conditions.push({ gt: toDate(filter.gt) })
  }
  if (filter.gte !== undefined) {
    conditions.push({ gte: toDate(filter.gte) })
  }
  if (filter.isNull === true) {
    conditions.push(null as unknown as Record<string, unknown>)
  }
  if (filter.isNull === false) {
    conditions.push({ not: null })
  }

  return conditions
}

// ─── Helper: JobStatusFilter → Prisma conditions ─────────────────────────────

function buildStatusConditions(
  filter: JobStatusFilter
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = []

  if (filter.eq !== undefined) {
    conditions.push(filter.eq as unknown as Record<string, unknown>)
  }
  if (filter.neq !== undefined) {
    conditions.push({ not: filter.neq })
  }
  if (filter.in !== undefined) {
    conditions.push({ in: [...filter.in] })
  }

  return conditions
}

// ─── Helper: NullFilter → Prisma condition ───────────────────────────────────

function buildNullCondition(filter: NullFilter): unknown {
  if (filter.isNull === true) {
    return null
  }
  if (filter.isNull === false) {
    return { not: null }
  }
  return undefined
}

// ─── Helper: Assign field conditions to result ───────────────────────────────

function assignFieldCondition(
  result: Record<string, unknown>,
  field: string,
  conditions: Record<string, unknown>[]
): void {
  if (conditions.length === 0) {
    return
  }
  if (conditions.length === 1) {
    const [condition] = conditions
    result[field] = condition
    return
  }
  // Multiple operators on same field: if all are objects, merge them
  const allObjects = conditions.every(
    (c) => c !== null && typeof c === "object"
  )
  result[field] = allObjects ? Object.assign({}, ...conditions) : conditions[0]
}

// ─── Field collectors ────────────────────────────────────────────────────────

function collectStringFields(
  where: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  const stringFields = [
    "id",
    "name",
    "uniqueKey",
    "groupKey",
    "flowId",
  ] as const

  for (const field of stringFields) {
    const filter = where[field]
    if (filter) {
      assignFieldCondition(result, field, buildStringConditions(filter))
    }
  }

  // parentId: StringFilter | NullFilter
  if (where.parentId) {
    const parentFilter = where.parentId
    if (
      "eq" in parentFilter ||
      "neq" in parentFilter ||
      "in" in parentFilter ||
      "contains" in parentFilter ||
      "startsWith" in parentFilter ||
      "like" in parentFilter
    ) {
      assignFieldCondition(
        result,
        "parentId",
        buildStringConditions(parentFilter as StringFilter)
      )
    } else {
      const cond = buildNullCondition(parentFilter as NullFilter)
      if (cond !== undefined) {
        result.parentId = cond
      }
    }
  }
}

function collectStatusField(
  where: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  if (where.status) {
    assignFieldCondition(result, "status", buildStatusConditions(where.status))
  }
}

function collectIntFields(
  where: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  const intFields = ["priority", "attempts", "progress", "repeatCount"] as const

  for (const field of intFields) {
    const filter = where[field]
    if (filter) {
      assignFieldCondition(result, field, buildIntConditions(filter))
    }
  }
}

function collectDateTimeFields(
  where: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  const dateFields = [
    "createdAt",
    "processAt",
    "processedAt",
    "completedAt",
    "failedAt",
    "cancelledAt",
  ] as const

  for (const field of dateFields) {
    const filter = where[field]
    if (filter) {
      assignFieldCondition(result, field, buildDateTimeConditions(filter))
    }
  }
}

function collectNullFields(
  where: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  const nullFields = ["cron", "timeout"] as const

  for (const field of nullFields) {
    const filter = where[field]
    if (filter) {
      const cond = buildNullCondition(filter)
      if (cond !== undefined) {
        result[field] = cond
      }
    }
  }
}

// ─── Main: buildWhere ────────────────────────────────────────────────────────

/**
 * Translate a `NormalizedJobWhereInput` into a Prisma-compatible where object.
 *
 * Returns a plain `Record<string, unknown>` suitable for spreading into
 * `prisma.queueJob.findMany({ where: ... })`. Handles AND/OR recursion,
 * date conversion, and LIKE-to-contains mapping.
 *
 * @param where - A normalized where input (use `normalizeWhere()` first)
 * @returns A Prisma-compatible where object
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/prisma"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const prismaWhere = buildWhere(normalized)
 * const jobs = await prisma.queueJob.findMany({ where: prismaWhere })
 * ```
 */
export function buildWhere(
  where: NormalizedJobWhereInput
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  collectStringFields(where, result)
  collectStatusField(where, result)
  collectIntFields(where, result)
  collectDateTimeFields(where, result)
  collectNullFields(where, result)

  if (where.AND) {
    result.AND = where.AND.map((clause) => buildWhere(clause))
  }

  if (where.OR) {
    result.OR = where.OR.map((clause) => buildWhere(clause))
  }

  return result
}
