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

// ─── Helper: StringFilter → RQB v2 conditions ────────────────────────────────

function buildStringConditions(
  filter: StringFilter
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = []

  if (filter.eq !== undefined) {
    conditions.push({ eq: filter.eq })
  }
  if (filter.neq !== undefined) {
    conditions.push({ ne: filter.neq })
  }
  if (filter.contains !== undefined) {
    conditions.push({ like: `%${filter.contains}%` })
  }
  if (filter.startsWith !== undefined) {
    conditions.push({ like: `${filter.startsWith}%` })
  }
  if (filter.like !== undefined) {
    conditions.push({ like: filter.like })
  }
  if (filter.in !== undefined) {
    conditions.push({ in: [...filter.in] })
  }
  if (filter.isNull === true) {
    conditions.push({ isNull: true })
  }
  if (filter.isNull === false) {
    conditions.push({ isNotNull: true })
  }

  return conditions
}

// ─── Helper: IntFilter → RQB v2 conditions ───────────────────────────────────

function buildIntConditions(filter: IntFilter): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = []

  if (filter.eq !== undefined) {
    conditions.push({ eq: filter.eq })
  }
  if (filter.neq !== undefined) {
    conditions.push({ ne: filter.neq })
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
    conditions.push({ isNull: true })
  }
  if (filter.isNull === false) {
    conditions.push({ isNotNull: true })
  }

  return conditions
}

// ─── Helper: DateTimeFilter → RQB v2 conditions ──────────────────────────────

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
    conditions.push({ isNull: true })
  }
  if (filter.isNull === false) {
    conditions.push({ isNotNull: true })
  }

  return conditions
}

// ─── Helper: JobStatusFilter → RQB v2 conditions ─────────────────────────────

function buildStatusConditions(
  filter: JobStatusFilter
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = []

  if (filter.eq !== undefined) {
    conditions.push({ eq: filter.eq })
  }
  if (filter.neq !== undefined) {
    conditions.push({ ne: filter.neq })
  }
  if (filter.in !== undefined) {
    conditions.push({ in: [...filter.in] })
  }

  return conditions
}

// ─── Helper: NullFilter → RQB v2 condition ───────────────────────────────────

function buildNullCondition(
  filter: NullFilter
): Record<string, unknown> | undefined {
  if (filter.isNull === true) {
    return { isNull: true }
  }
  if (filter.isNull === false) {
    return { isNotNull: true }
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
  // Multiple operators on same field: merge into a single object
  result[field] = Object.assign({}, ...conditions)
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
 * Translate a `NormalizedJobWhereInput` into a RQB v2-compatible where object.
 *
 * Returns a plain `Record<string, unknown>` suitable for passing to
 * `db.query.<table>.findMany({ where: ... })` or `findFirst({ where: ... })`.
 * Handles AND/OR recursion, date conversion, and operator mapping.
 *
 * @param where - A normalized where input (use `normalizeWhere()` first)
 * @returns A RQB v2-compatible where object
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/drizzle"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const whereObj = buildWhere(normalized)
 * const jobs = await db.query.queueJobs.findMany({ where: whereObj })
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
