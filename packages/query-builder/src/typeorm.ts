/**
 * TypeORM query builder for vorsteh-queue.
 *
 * Translates a `NormalizedJobWhereInput` into a TypeORM-compatible
 * `FindOptionsWhere` object using TypeORM's `FindOperator` helpers.
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/typeorm"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const where = buildWhere(normalized)
 * const jobs = await repository.find({ where })
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

// ─── TypeORM FindOperator-compatible structures ──────────────────────────────

/**
 * Build a TypeORM-compatible filter value for a string field.
 *
 * TypeORM uses `{ _type: "...", _value: ... }` FindOperator objects internally,
 * but for `find()` we can use shorthand objects with operators.
 */
function buildStringCondition(filter: StringFilter): unknown {
  const conditions: Record<string, unknown>[] = []

  if (filter.eq !== undefined) {
    conditions.push({ _type: "equal", _value: filter.eq })
  }
  if (filter.neq !== undefined) {
    conditions.push({ _type: "not", _value: filter.neq })
  }
  if (filter.contains !== undefined) {
    conditions.push({ _type: "like", _value: `%${filter.contains}%` })
  }
  if (filter.startsWith !== undefined) {
    conditions.push({ _type: "like", _value: `${filter.startsWith}%` })
  }
  if (filter.like !== undefined) {
    conditions.push({ _type: "like", _value: filter.like })
  }
  if (filter.in !== undefined) {
    conditions.push({ _type: "in", _value: [...filter.in] })
  }
  if (filter.isNull === true) {
    conditions.push({ _type: "isNull", _value: undefined })
  }
  if (filter.isNull === false) {
    conditions.push({
      _type: "not",
      _value: { _type: "isNull", _value: undefined },
    })
  }

  return conditions.length === 1 ? conditions[0] : conditions[0]
}

function buildIntCondition(filter: IntFilter): unknown {
  const conditions: Record<string, unknown> = {}

  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    conditions._type = "not"
    conditions._value = filter.neq
    return conditions
  }
  if (filter.lt !== undefined) {
    return { _type: "lessThan", _value: filter.lt }
  }
  if (filter.lte !== undefined) {
    return { _type: "lessThanOrEqual", _value: filter.lte }
  }
  if (filter.gt !== undefined) {
    return { _type: "moreThan", _value: filter.gt }
  }
  if (filter.gte !== undefined) {
    return { _type: "moreThanOrEqual", _value: filter.gte }
  }
  if (filter.isNull === true) {
    return { _type: "isNull", _value: undefined }
  }
  if (filter.isNull === false) {
    return { _type: "not", _value: { _type: "isNull", _value: undefined } }
  }

  return undefined
}

function buildDateTimeCondition(filter: DateTimeFilter): unknown {
  if (filter.lt !== undefined) {
    return { _type: "lessThan", _value: toDate(filter.lt) }
  }
  if (filter.lte !== undefined) {
    return { _type: "lessThanOrEqual", _value: toDate(filter.lte) }
  }
  if (filter.gt !== undefined) {
    return { _type: "moreThan", _value: toDate(filter.gt) }
  }
  if (filter.gte !== undefined) {
    return { _type: "moreThanOrEqual", _value: toDate(filter.gte) }
  }
  if (filter.isNull === true) {
    return { _type: "isNull", _value: undefined }
  }
  if (filter.isNull === false) {
    return { _type: "not", _value: { _type: "isNull", _value: undefined } }
  }
  return undefined
}

function buildStatusCondition(filter: JobStatusFilter): unknown {
  if (filter.eq !== undefined) {
    return filter.eq
  }
  if (filter.neq !== undefined) {
    return { _type: "not", _value: filter.neq }
  }
  if (filter.in !== undefined) {
    return { _type: "in", _value: [...filter.in] }
  }
  return undefined
}

function buildNullCondition(filter: NullFilter): unknown {
  if (filter.isNull === true) {
    return { _type: "isNull", _value: undefined }
  }
  if (filter.isNull === false) {
    return { _type: "not", _value: { _type: "isNull", _value: undefined } }
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

function collectIntFields(
  where: NormalizedJobWhereInput,
  result: Record<string, unknown>
): void {
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
      const cond = buildDateTimeCondition(filter)
      if (cond !== undefined) {
        result[field] = cond
      }
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
 * Translate a `NormalizedJobWhereInput` into a TypeORM-compatible where object.
 *
 * @param where - A normalized where input (use `normalizeWhere()` first)
 * @returns A TypeORM-compatible where object
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/typeorm"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const where = buildWhere(normalized)
 * const jobs = await repository.find({ where })
 * ```
 */
export function buildWhere(
  where: NormalizedJobWhereInput
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  collectStringFields(where, result)

  if (where.status) {
    result.status = buildStatusCondition(where.status)
  }

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
