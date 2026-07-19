/**
 * MikroORM query builder for vorsteh-queue.
 *
 * Translates a `NormalizedJobWhereInput` into a MikroORM-compatible
 * `FilterQuery` object for use with EntityManager.find().
 *
 * MikroORM uses a MongoDB-like filter syntax with `$eq`, `$in`, `$like`, etc.
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/mikroorm"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const where = buildWhere(normalized)
 * const jobs = await em.find(QueueJobEntity, where)
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

// ─── MikroORM filter builders ────────────────────────────────────────────────

function buildStringCondition(filter: StringFilter): unknown {
  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    return { $ne: filter.neq }
  }
  if (filter.contains !== undefined) {
    return { $like: `%${filter.contains}%` }
  }
  if (filter.startsWith !== undefined) {
    return { $like: `${filter.startsWith}%` }
  }
  if (filter.like !== undefined) {
    return { $like: filter.like }
  }
  if (filter.in !== undefined) {
    return { $in: [...filter.in] }
  }
  if (filter.isNull === true) {
    return null
  }
  if (filter.isNull === false) {
    return { $ne: null }
  }
  return undefined
}

function buildIntCondition(filter: IntFilter): unknown {
  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    return { $ne: filter.neq }
  }
  if (filter.lt !== undefined) {
    return { $lt: filter.lt }
  }
  if (filter.lte !== undefined) {
    return { $lte: filter.lte }
  }
  if (filter.gt !== undefined) {
    return { $gt: filter.gt }
  }
  if (filter.gte !== undefined) {
    return { $gte: filter.gte }
  }
  if (filter.isNull === true) {
    return null
  }
  if (filter.isNull === false) {
    return { $ne: null }
  }
  return undefined
}

function buildDateTimeCondition(filter: DateTimeFilter): unknown {
  if (filter.lt !== undefined) {
    return { $lt: toDate(filter.lt) }
  }
  if (filter.lte !== undefined) {
    return { $lte: toDate(filter.lte) }
  }
  if (filter.gt !== undefined) {
    return { $gt: toDate(filter.gt) }
  }
  if (filter.gte !== undefined) {
    return { $gte: toDate(filter.gte) }
  }
  if (filter.isNull === true) {
    return null
  }
  if (filter.isNull === false) {
    return { $ne: null }
  }
  return undefined
}

function buildStatusCondition(filter: JobStatusFilter): unknown {
  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    return { $ne: filter.neq }
  }
  if (filter.in !== undefined) {
    return { $in: [...filter.in] }
  }
  return undefined
}

function buildNullCondition(filter: NullFilter): unknown {
  if (filter.isNull === true) {
    return null
  }
  if (filter.isNull === false) {
    return { $ne: null }
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
 * Translate a `NormalizedJobWhereInput` into a MikroORM-compatible filter object.
 *
 * @param where - A normalized where input (use `normalizeWhere()` first)
 * @returns A MikroORM-compatible FilterQuery object
 */
export function buildWhere(
  where: NormalizedJobWhereInput
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  collectStringFields(where, result)
  collectOtherFields(where, result)

  if (where.AND) {
    result.$and = where.AND.map((clause) => buildWhere(clause))
  }
  if (where.OR) {
    result.$or = where.OR.map((clause) => buildWhere(clause))
  }

  return result
}
