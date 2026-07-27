/**
 * Sequelize query builder for vorsteh-queue.
 *
 * Translates a `NormalizedJobWhereInput` into a Sequelize-compatible
 * `WhereOptions` object using Sequelize's `Op` symbol operators.
 *
 * Since the adapter uses raw SQL for critical operations, this module
 * provides a simplified translation for `getJobs`/`size` queries that
 * works with Sequelize's `Op`-based where syntax.
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/sequelize"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const where = buildWhere(normalized)
 * const jobs = await QueueJob.findAll({ where })
 * ```
 */

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

// ─── Sequelize Op-symbol compatible structures ───────────────────────────────
// We use string-keyed objects that match Sequelize's Op symbols
// The adapter will map these to actual Op symbols at runtime

function buildStringCondition(filter: StringFilter): unknown {
  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    return { _op: "ne", _value: filter.neq }
  }
  if (filter.contains !== undefined) {
    return { _op: "like", _value: `%${filter.contains}%` }
  }
  if (filter.startsWith !== undefined) {
    return { _op: "like", _value: `${filter.startsWith}%` }
  }
  if (filter.like !== undefined) {
    return { _op: "like", _value: filter.like }
  }
  if (filter.in !== undefined) {
    return { _op: "in", _value: [...filter.in] }
  }
  if (filter.isNull === true) {
    return { _op: "is", _value: null }
  }
  if (filter.isNull === false) {
    return { _op: "not", _value: null }
  }
  return undefined
}

function buildIntCondition(filter: IntFilter): unknown {
  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    return { _op: "ne", _value: filter.neq }
  }
  if (filter.lt !== undefined) {
    return { _op: "lt", _value: filter.lt }
  }
  if (filter.lte !== undefined) {
    return { _op: "lte", _value: filter.lte }
  }
  if (filter.gt !== undefined) {
    return { _op: "gt", _value: filter.gt }
  }
  if (filter.gte !== undefined) {
    return { _op: "gte", _value: filter.gte }
  }
  if (filter.isNull === true) {
    return { _op: "is", _value: null }
  }
  if (filter.isNull === false) {
    return { _op: "not", _value: null }
  }
  return undefined
}

function buildDateTimeCondition(filter: DateTimeFilter): unknown {
  if (filter.lt !== undefined) {
    return { _op: "lt", _value: toDate(filter.lt) }
  }
  if (filter.lte !== undefined) {
    return { _op: "lte", _value: toDate(filter.lte) }
  }
  if (filter.gt !== undefined) {
    return { _op: "gt", _value: toDate(filter.gt) }
  }
  if (filter.gte !== undefined) {
    return { _op: "gte", _value: toDate(filter.gte) }
  }
  if (filter.isNull === true) {
    return { _op: "is", _value: null }
  }
  if (filter.isNull === false) {
    return { _op: "not", _value: null }
  }
  return undefined
}

function buildStatusCondition(filter: JobStatusFilter): unknown {
  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    return { _op: "ne", _value: filter.neq }
  }
  if (filter.in !== undefined) {
    return { _op: "in", _value: [...filter.in] }
  }
  return undefined
}

function buildNullCondition(filter: NullFilter): unknown {
  if (filter.isNull === true) {
    return { _op: "is", _value: null }
  }
  if (filter.isNull === false) {
    return { _op: "not", _value: null }
  }
  return undefined
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
      result[field] = buildStringCondition(filter)
    }
  }

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
      result.parentId = buildStringCondition(parentFilter as StringFilter)
    } else {
      const cond = buildNullCondition(parentFilter as NullFilter)
      if (cond !== undefined) {
        result.parentId = cond
      }
    }
  }
}

function collectOtherFields(
  where: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
  if (where.status) {
    const cond = buildStatusCondition(where.status)
    if (cond !== undefined) {
      result.status = cond
    }
  }

  const intFields = ["priority", "attempts", "progress", "repeatCount"] as const
  for (const field of intFields) {
    const filter = where[field]
    if (filter) {
      const cond = buildIntCondition(filter)
      if (cond !== undefined) {
        result[field] = cond
      }
    }
  }

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
      const cond = buildDateTimeCondition(filter)
      if (cond !== undefined) {
        result[field] = cond
      }
    }
  }

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
 * Translate a `NormalizedJobWhereInput` into a Sequelize-compatible where object.
 *
 * @param where - A normalized where input (use `normalizeWhere()` first)
 * @returns A Sequelize-compatible where object
 */
export function buildWhere(
  where: NormalizedJobWhereInput
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  collectStringFields(where, result)
  collectOtherFields(where, result)

  if (where.AND) {
    result._and = where.AND.map((clause) => buildWhere(clause))
  }
  if (where.OR) {
    result._or = where.OR.map((clause) => buildWhere(clause))
  }

  return result
}
