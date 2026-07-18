import type { Column, SQL } from "drizzle-orm"
import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  or,
} from "drizzle-orm"

import type {
  DateTimeFilter,
  IntFilter,
  JobStatusFilter,
  NormalizedJobWhereInput,
  NullFilter,
  StringFilter,
} from "./types"

/**
 * Drizzle table interface representing the expected job columns.
 * Works with any Drizzle pgTable that defines these columns.
 */
export interface DrizzleJobTable {
  id: Column
  name: Column
  status: Column
  priority: Column
  attempts: Column
  progress: Column
  createdAt: Column
  processAt: Column
  processedAt: Column
  completedAt: Column
  failedAt: Column
  cancelledAt: Column
  cron: Column
  repeatCount: Column
  timeout: Column
  groupKey: Column
  uniqueKey: Column
  flowId: Column
  parentId: Column
}

// ─── Helper: String filter to SQL conditions ─────────────────────────────────

function applyStringFilter(col: Column, filter: StringFilter): SQL[] {
  const conditions: SQL[] = []

  if (filter.eq !== undefined) {
    conditions.push(eq(col, filter.eq))
  }
  if (filter.neq !== undefined) {
    conditions.push(ne(col, filter.neq))
  }
  if (filter.contains !== undefined) {
    conditions.push(like(col, `%${filter.contains}%`))
  }
  if (filter.startsWith !== undefined) {
    conditions.push(like(col, `${filter.startsWith}%`))
  }
  if (filter.like !== undefined) {
    conditions.push(like(col, filter.like))
  }
  if (filter.in !== undefined) {
    conditions.push(inArray(col, [...filter.in]))
  }
  if (filter.isNull === true) {
    conditions.push(isNull(col))
  }
  if (filter.isNull === false) {
    conditions.push(isNotNull(col))
  }

  return conditions
}

// ─── Helper: Int filter to SQL conditions ────────────────────────────────────

function applyIntFilter(col: Column, filter: IntFilter): SQL[] {
  const conditions: SQL[] = []

  if (filter.eq !== undefined) {
    conditions.push(eq(col, filter.eq))
  }
  if (filter.neq !== undefined) {
    conditions.push(ne(col, filter.neq))
  }
  if (filter.lt !== undefined) {
    conditions.push(lt(col, filter.lt))
  }
  if (filter.lte !== undefined) {
    conditions.push(lte(col, filter.lte))
  }
  if (filter.gt !== undefined) {
    conditions.push(gt(col, filter.gt))
  }
  if (filter.gte !== undefined) {
    conditions.push(gte(col, filter.gte))
  }
  if (filter.isNull === true) {
    conditions.push(isNull(col))
  }
  if (filter.isNull === false) {
    conditions.push(isNotNull(col))
  }

  return conditions
}

// ─── Helper: DateTime filter to SQL conditions ───────────────────────────────

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function applyDateTimeFilter(col: Column, filter: DateTimeFilter): SQL[] {
  const conditions: SQL[] = []

  if (filter.lt !== undefined) {
    conditions.push(lt(col, toDate(filter.lt)))
  }
  if (filter.lte !== undefined) {
    conditions.push(lte(col, toDate(filter.lte)))
  }
  if (filter.gt !== undefined) {
    conditions.push(gt(col, toDate(filter.gt)))
  }
  if (filter.gte !== undefined) {
    conditions.push(gte(col, toDate(filter.gte)))
  }
  if (filter.isNull === true) {
    conditions.push(isNull(col))
  }
  if (filter.isNull === false) {
    conditions.push(isNotNull(col))
  }

  return conditions
}

// ─── Helper: Status filter to SQL conditions ─────────────────────────────────

function applyStatusFilter(col: Column, filter: JobStatusFilter): SQL[] {
  const conditions: SQL[] = []

  if (filter.eq !== undefined) {
    conditions.push(eq(col, filter.eq))
  }
  if (filter.neq !== undefined) {
    conditions.push(ne(col, filter.neq))
  }
  if (filter.in !== undefined) {
    conditions.push(inArray(col, [...filter.in]))
  }

  return conditions
}

// ─── Helper: Null-only filter to SQL conditions ──────────────────────────────

function applyNullFilter(col: Column, filter: NullFilter): SQL[] {
  const conditions: SQL[] = []

  if (filter.isNull === true) {
    conditions.push(isNull(col))
  }
  if (filter.isNull === false) {
    conditions.push(isNotNull(col))
  }

  return conditions
}

// ─── Helper: parentId filter (StringFilter | NullFilter) ─────────────────────

function applyParentIdFilter(
  col: Column,
  filter: StringFilter | NullFilter
): SQL[] {
  if ("eq" in filter || "neq" in filter || "in" in filter) {
    return applyStringFilter(col, filter as StringFilter)
  }
  return applyNullFilter(col, filter as NullFilter)
}

// ─── Field condition collectors (split for complexity) ────────────────────────

function collectStringFieldConditions(
  where: NormalizedJobWhereInput,
  table: DrizzleJobTable
): SQL[] {
  const conditions: SQL[] = []

  if (where.id) {
    conditions.push(...applyStringFilter(table.id, where.id))
  }
  if (where.name) {
    conditions.push(...applyStringFilter(table.name, where.name))
  }
  if (where.uniqueKey) {
    conditions.push(...applyStringFilter(table.uniqueKey, where.uniqueKey))
  }
  if (where.groupKey) {
    conditions.push(...applyStringFilter(table.groupKey, where.groupKey))
  }
  if (where.flowId) {
    conditions.push(...applyStringFilter(table.flowId, where.flowId))
  }
  if (where.parentId) {
    conditions.push(...applyParentIdFilter(table.parentId, where.parentId))
  }

  return conditions
}

function collectNumericFieldConditions(
  where: NormalizedJobWhereInput,
  table: DrizzleJobTable
): SQL[] {
  const conditions: SQL[] = []

  if (where.status) {
    conditions.push(...applyStatusFilter(table.status, where.status))
  }
  if (where.priority) {
    conditions.push(...applyIntFilter(table.priority, where.priority))
  }
  if (where.attempts) {
    conditions.push(...applyIntFilter(table.attempts, where.attempts))
  }
  if (where.progress) {
    conditions.push(...applyIntFilter(table.progress, where.progress))
  }
  if (where.repeatCount) {
    conditions.push(...applyIntFilter(table.repeatCount, where.repeatCount))
  }

  return conditions
}

function collectDateTimeFieldConditions(
  where: NormalizedJobWhereInput,
  table: DrizzleJobTable
): SQL[] {
  const conditions: SQL[] = []

  if (where.createdAt) {
    conditions.push(...applyDateTimeFilter(table.createdAt, where.createdAt))
  }
  if (where.processAt) {
    conditions.push(...applyDateTimeFilter(table.processAt, where.processAt))
  }
  if (where.processedAt) {
    conditions.push(
      ...applyDateTimeFilter(table.processedAt, where.processedAt)
    )
  }
  if (where.completedAt) {
    conditions.push(
      ...applyDateTimeFilter(table.completedAt, where.completedAt)
    )
  }
  if (where.failedAt) {
    conditions.push(...applyDateTimeFilter(table.failedAt, where.failedAt))
  }
  if (where.cancelledAt) {
    conditions.push(
      ...applyDateTimeFilter(table.cancelledAt, where.cancelledAt)
    )
  }

  return conditions
}

function collectNullFieldConditions(
  where: NormalizedJobWhereInput,
  table: DrizzleJobTable
): SQL[] {
  const conditions: SQL[] = []

  if (where.cron) {
    conditions.push(...applyNullFilter(table.cron, where.cron))
  }
  if (where.timeout) {
    conditions.push(...applyNullFilter(table.timeout, where.timeout))
  }

  return conditions
}

/**
 * Translate a `NormalizedJobWhereInput` into Drizzle ORM SQL conditions.
 *
 * Recursively handles `AND` / `OR` logical operators. Top-level field conditions
 * are combined with `and(...)`. Returns `undefined` when no conditions are specified.
 *
 * @param where - A normalized where input (use `normalizeWhere()` first)
 * @param table - A Drizzle table reference with the expected job columns
 * @returns A Drizzle `SQL` condition, or `undefined` if no filters are present
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/drizzle"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 * import { queueJobs } from "@vorsteh-queue/adapter-drizzle/postgres-schema"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const sql = buildWhere(normalized, queueJobs)
 * // Use in: db.select().from(queueJobs).where(sql)
 * ```
 */
export function buildWhere(
  where: NormalizedJobWhereInput,
  table: DrizzleJobTable
): SQL | undefined {
  const conditions = [
    ...collectStringFieldConditions(where, table),
    ...collectNumericFieldConditions(where, table),
    ...collectDateTimeFieldConditions(where, table),
    ...collectNullFieldConditions(where, table),
  ]

  // Handle AND recursion
  if (where.AND) {
    for (const clause of where.AND) {
      const sub = buildWhere(clause, table)
      if (sub) {
        conditions.push(sub)
      }
    }
  }

  // Handle OR recursion
  if (where.OR) {
    const orClauses = where.OR.map((clause) =>
      buildWhere(clause, table)
    ).filter((sql): sql is SQL => sql !== undefined)

    if (orClauses.length > 0) {
      const orResult = or(...orClauses)
      if (orResult) {
        conditions.push(orResult)
      }
    }
  }

  if (conditions.length === 0) {
    return undefined
  }
  if (conditions.length === 1) {
    return conditions[0]
  }
  return and(...conditions)
}
