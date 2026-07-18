import type { ExpressionBuilder, SelectQueryBuilder } from "kysely"

import type {
  DateTimeFilter,
  IntFilter,
  JobStatusFilter,
  NormalizedJobWhereInput,
  NullFilter,
  StringFilter,
} from "./types"

// ─── Column Name Mapping ──────────────────────────────────────────────────────

/** Maps camelCase field names to snake_case database column names */
const COLUMN_MAP = {
  id: "id",
  name: "name",
  status: "status",
  priority: "priority",
  attempts: "attempts",
  progress: "progress",
  createdAt: "created_at",
  processAt: "process_at",
  processedAt: "processed_at",
  completedAt: "completed_at",
  failedAt: "failed_at",
  cancelledAt: "cancelled_at",
  cron: "cron",
  repeatCount: "repeat_count",
  timeout: "timeout",
  groupKey: "group_key",
  uniqueKey: "unique_key",
  flowId: "flow_id",
  parentId: "parent_id",
} as const

type ColumnName = (typeof COLUMN_MAP)[keyof typeof COLUMN_MAP]

// ─── Generic column reference type ───────────────────────────────────────────

// oxlint-disable-next-line typescript/no-explicit-any
type AnyRef = any

// ─── Helper: Convert Date | string → Date ────────────────────────────────────

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

// ─── Helper: Apply StringFilter ──────────────────────────────────────────────

function applyStringFilter<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  col: ColumnName,
  filter: StringFilter
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (filter.eq !== undefined) {
    result = result.where(col as AnyRef, "=", filter.eq)
  }
  if (filter.neq !== undefined) {
    result = result.where(col as AnyRef, "!=", filter.neq)
  }
  if (filter.contains !== undefined) {
    result = result.where(col as AnyRef, "like", `%${filter.contains}%`)
  }
  if (filter.startsWith !== undefined) {
    result = result.where(col as AnyRef, "like", `${filter.startsWith}%`)
  }
  if (filter.like !== undefined) {
    result = result.where(col as AnyRef, "like", filter.like)
  }
  if (filter.in !== undefined) {
    result = result.where(col as AnyRef, "in", [...filter.in])
  }
  if (filter.isNull === true) {
    result = result.where(col as AnyRef, "is", null)
  }
  if (filter.isNull === false) {
    result = result.where(col as AnyRef, "is not", null)
  }

  return result
}

// ─── Helper: Apply IntFilter ─────────────────────────────────────────────────

function applyIntFilter<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  col: ColumnName,
  filter: IntFilter
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (filter.eq !== undefined) {
    result = result.where(col as AnyRef, "=", filter.eq)
  }
  if (filter.neq !== undefined) {
    result = result.where(col as AnyRef, "!=", filter.neq)
  }
  if (filter.lt !== undefined) {
    result = result.where(col as AnyRef, "<", filter.lt)
  }
  if (filter.lte !== undefined) {
    result = result.where(col as AnyRef, "<=", filter.lte)
  }
  if (filter.gt !== undefined) {
    result = result.where(col as AnyRef, ">", filter.gt)
  }
  if (filter.gte !== undefined) {
    result = result.where(col as AnyRef, ">=", filter.gte)
  }
  if (filter.isNull === true) {
    result = result.where(col as AnyRef, "is", null)
  }
  if (filter.isNull === false) {
    result = result.where(col as AnyRef, "is not", null)
  }

  return result
}

// ─── Helper: Apply DateTimeFilter ────────────────────────────────────────────

function applyDateTimeFilter<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  col: ColumnName,
  filter: DateTimeFilter
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (filter.lt !== undefined) {
    result = result.where(col as AnyRef, "<", toDate(filter.lt))
  }
  if (filter.lte !== undefined) {
    result = result.where(col as AnyRef, "<=", toDate(filter.lte))
  }
  if (filter.gt !== undefined) {
    result = result.where(col as AnyRef, ">", toDate(filter.gt))
  }
  if (filter.gte !== undefined) {
    result = result.where(col as AnyRef, ">=", toDate(filter.gte))
  }
  if (filter.isNull === true) {
    result = result.where(col as AnyRef, "is", null)
  }
  if (filter.isNull === false) {
    result = result.where(col as AnyRef, "is not", null)
  }

  return result
}

// ─── Helper: Apply JobStatusFilter ───────────────────────────────────────────

function applyStatusFilter<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  col: ColumnName,
  filter: JobStatusFilter
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (filter.eq !== undefined) {
    result = result.where(col as AnyRef, "=", filter.eq)
  }
  if (filter.neq !== undefined) {
    result = result.where(col as AnyRef, "!=", filter.neq)
  }
  if (filter.in !== undefined) {
    result = result.where(col as AnyRef, "in", [...filter.in])
  }

  return result
}

// ─── Helper: Apply NullFilter ────────────────────────────────────────────────

function applyNullFilter<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  col: ColumnName,
  filter: NullFilter
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (filter.isNull === true) {
    result = result.where(col as AnyRef, "is", null)
  }
  if (filter.isNull === false) {
    result = result.where(col as AnyRef, "is not", null)
  }

  return result
}

// ─── Helper: Apply parentId filter (StringFilter | NullFilter) ───────────────

function applyParentIdFilter<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  col: ColumnName,
  filter: StringFilter | NullFilter
): SelectQueryBuilder<DB, TB, object> {
  if ("eq" in filter || "neq" in filter || "in" in filter) {
    return applyStringFilter(query, col, filter as StringFilter)
  }
  return applyNullFilter(query, col, filter as NullFilter)
}

// ─── Expression builder helpers for OR sub-expressions ───────────────────────

function stringFilterExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  col: ColumnName,
  filter: StringFilter
): AnyRef[] {
  const exprs: AnyRef[] = []
  if (filter.eq !== undefined) {
    exprs.push(eb(col as AnyRef, "=", filter.eq))
  }
  if (filter.neq !== undefined) {
    exprs.push(eb(col as AnyRef, "!=", filter.neq))
  }
  if (filter.contains !== undefined) {
    exprs.push(eb(col as AnyRef, "like", `%${filter.contains}%`))
  }
  if (filter.startsWith !== undefined) {
    exprs.push(eb(col as AnyRef, "like", `${filter.startsWith}%`))
  }
  if (filter.like !== undefined) {
    exprs.push(eb(col as AnyRef, "like", filter.like))
  }
  if (filter.in !== undefined) {
    exprs.push(eb(col as AnyRef, "in", [...filter.in]))
  }
  if (filter.isNull === true) {
    exprs.push(eb(col as AnyRef, "is", null))
  }
  if (filter.isNull === false) {
    exprs.push(eb(col as AnyRef, "is not", null))
  }
  return exprs
}

function intFilterExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  col: ColumnName,
  filter: IntFilter
): AnyRef[] {
  const exprs: AnyRef[] = []
  if (filter.eq !== undefined) {
    exprs.push(eb(col as AnyRef, "=", filter.eq))
  }
  if (filter.neq !== undefined) {
    exprs.push(eb(col as AnyRef, "!=", filter.neq))
  }
  if (filter.lt !== undefined) {
    exprs.push(eb(col as AnyRef, "<", filter.lt))
  }
  if (filter.lte !== undefined) {
    exprs.push(eb(col as AnyRef, "<=", filter.lte))
  }
  if (filter.gt !== undefined) {
    exprs.push(eb(col as AnyRef, ">", filter.gt))
  }
  if (filter.gte !== undefined) {
    exprs.push(eb(col as AnyRef, ">=", filter.gte))
  }
  if (filter.isNull === true) {
    exprs.push(eb(col as AnyRef, "is", null))
  }
  if (filter.isNull === false) {
    exprs.push(eb(col as AnyRef, "is not", null))
  }
  return exprs
}

function dateTimeFilterExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  col: ColumnName,
  filter: DateTimeFilter
): AnyRef[] {
  const exprs: AnyRef[] = []
  if (filter.lt !== undefined) {
    exprs.push(eb(col as AnyRef, "<", toDate(filter.lt)))
  }
  if (filter.lte !== undefined) {
    exprs.push(eb(col as AnyRef, "<=", toDate(filter.lte)))
  }
  if (filter.gt !== undefined) {
    exprs.push(eb(col as AnyRef, ">", toDate(filter.gt)))
  }
  if (filter.gte !== undefined) {
    exprs.push(eb(col as AnyRef, ">=", toDate(filter.gte)))
  }
  if (filter.isNull === true) {
    exprs.push(eb(col as AnyRef, "is", null))
  }
  if (filter.isNull === false) {
    exprs.push(eb(col as AnyRef, "is not", null))
  }
  return exprs
}

function statusFilterExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  col: ColumnName,
  filter: JobStatusFilter
): AnyRef[] {
  const exprs: AnyRef[] = []
  if (filter.eq !== undefined) {
    exprs.push(eb(col as AnyRef, "=", filter.eq))
  }
  if (filter.neq !== undefined) {
    exprs.push(eb(col as AnyRef, "!=", filter.neq))
  }
  if (filter.in !== undefined) {
    exprs.push(eb(col as AnyRef, "in", [...filter.in]))
  }
  return exprs
}

function nullFilterExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  col: ColumnName,
  filter: NullFilter
): AnyRef[] {
  const exprs: AnyRef[] = []
  if (filter.isNull === true) {
    exprs.push(eb(col as AnyRef, "is", null))
  }
  if (filter.isNull === false) {
    exprs.push(eb(col as AnyRef, "is not", null))
  }
  return exprs
}

// ─── Expression builder: collect string field expressions ────────────────────

function collectStringExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  where: NormalizedJobWhereInput
): AnyRef[] {
  const exprs: AnyRef[] = []

  if (where.id) {
    exprs.push(...stringFilterExpressions(eb, COLUMN_MAP.id, where.id))
  }
  if (where.name) {
    exprs.push(...stringFilterExpressions(eb, COLUMN_MAP.name, where.name))
  }
  if (where.uniqueKey) {
    exprs.push(
      ...stringFilterExpressions(eb, COLUMN_MAP.uniqueKey, where.uniqueKey)
    )
  }
  if (where.groupKey) {
    exprs.push(
      ...stringFilterExpressions(eb, COLUMN_MAP.groupKey, where.groupKey)
    )
  }
  if (where.flowId) {
    exprs.push(...stringFilterExpressions(eb, COLUMN_MAP.flowId, where.flowId))
  }
  if (where.parentId) {
    if (
      "eq" in where.parentId ||
      "neq" in where.parentId ||
      "in" in where.parentId
    ) {
      exprs.push(
        ...stringFilterExpressions(
          eb,
          COLUMN_MAP.parentId,
          where.parentId as StringFilter
        )
      )
    } else {
      exprs.push(
        ...nullFilterExpressions(eb, COLUMN_MAP.parentId, where.parentId)
      )
    }
  }

  return exprs
}

// ─── Expression builder: collect numeric/status field expressions ─────────────

function collectNumericExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  where: NormalizedJobWhereInput
): AnyRef[] {
  const exprs: AnyRef[] = []

  if (where.status) {
    exprs.push(...statusFilterExpressions(eb, COLUMN_MAP.status, where.status))
  }
  if (where.priority) {
    exprs.push(...intFilterExpressions(eb, COLUMN_MAP.priority, where.priority))
  }
  if (where.attempts) {
    exprs.push(...intFilterExpressions(eb, COLUMN_MAP.attempts, where.attempts))
  }
  if (where.progress) {
    exprs.push(...intFilterExpressions(eb, COLUMN_MAP.progress, where.progress))
  }
  if (where.repeatCount) {
    exprs.push(
      ...intFilterExpressions(eb, COLUMN_MAP.repeatCount, where.repeatCount)
    )
  }

  return exprs
}

// ─── Expression builder: collect datetime field expressions ──────────────────

function collectDateTimeExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  where: NormalizedJobWhereInput
): AnyRef[] {
  const exprs: AnyRef[] = []

  if (where.createdAt) {
    exprs.push(
      ...dateTimeFilterExpressions(eb, COLUMN_MAP.createdAt, where.createdAt)
    )
  }
  if (where.processAt) {
    exprs.push(
      ...dateTimeFilterExpressions(eb, COLUMN_MAP.processAt, where.processAt)
    )
  }
  if (where.processedAt) {
    exprs.push(
      ...dateTimeFilterExpressions(
        eb,
        COLUMN_MAP.processedAt,
        where.processedAt
      )
    )
  }
  if (where.completedAt) {
    exprs.push(
      ...dateTimeFilterExpressions(
        eb,
        COLUMN_MAP.completedAt,
        where.completedAt
      )
    )
  }
  if (where.failedAt) {
    exprs.push(
      ...dateTimeFilterExpressions(eb, COLUMN_MAP.failedAt, where.failedAt)
    )
  }
  if (where.cancelledAt) {
    exprs.push(
      ...dateTimeFilterExpressions(
        eb,
        COLUMN_MAP.cancelledAt,
        where.cancelledAt
      )
    )
  }

  return exprs
}

// ─── Expression builder: collect null-only field expressions ─────────────────

function collectNullExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  where: NormalizedJobWhereInput
): AnyRef[] {
  const exprs: AnyRef[] = []

  if (where.cron) {
    exprs.push(...nullFilterExpressions(eb, COLUMN_MAP.cron, where.cron))
  }
  if (where.timeout) {
    exprs.push(...nullFilterExpressions(eb, COLUMN_MAP.timeout, where.timeout))
  }

  return exprs
}

// ─── Expression builder: all expressions for a single where clause ───────────

function buildExpressions<DB, TB extends keyof DB>(
  eb: ExpressionBuilder<DB, TB>,
  where: NormalizedJobWhereInput
): AnyRef[] {
  const exprs = [
    ...collectStringExpressions(eb, where),
    ...collectNumericExpressions(eb, where),
    ...collectDateTimeExpressions(eb, where),
    ...collectNullExpressions(eb, where),
  ]

  if (where.AND) {
    for (const clause of where.AND) {
      exprs.push(...buildExpressions(eb, clause))
    }
  }

  if (where.OR) {
    const orExpressions = where.OR.map((clause) =>
      eb.and(buildExpressions(eb, clause))
    )
    exprs.push(eb.or(orExpressions))
  }

  return exprs
}

// ─── Field application: string fields ────────────────────────────────────────

function applyStringFields<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  where: NormalizedJobWhereInput
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (where.id) {
    result = applyStringFilter(result, COLUMN_MAP.id, where.id)
  }
  if (where.name) {
    result = applyStringFilter(result, COLUMN_MAP.name, where.name)
  }
  if (where.uniqueKey) {
    result = applyStringFilter(result, COLUMN_MAP.uniqueKey, where.uniqueKey)
  }
  if (where.groupKey) {
    result = applyStringFilter(result, COLUMN_MAP.groupKey, where.groupKey)
  }
  if (where.flowId) {
    result = applyStringFilter(result, COLUMN_MAP.flowId, where.flowId)
  }
  if (where.parentId) {
    result = applyParentIdFilter(result, COLUMN_MAP.parentId, where.parentId)
  }

  return result
}

// ─── Field application: numeric/status fields ────────────────────────────────

function applyNumericFields<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  where: NormalizedJobWhereInput
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (where.status) {
    result = applyStatusFilter(result, COLUMN_MAP.status, where.status)
  }
  if (where.priority) {
    result = applyIntFilter(result, COLUMN_MAP.priority, where.priority)
  }
  if (where.attempts) {
    result = applyIntFilter(result, COLUMN_MAP.attempts, where.attempts)
  }
  if (where.progress) {
    result = applyIntFilter(result, COLUMN_MAP.progress, where.progress)
  }
  if (where.repeatCount) {
    result = applyIntFilter(result, COLUMN_MAP.repeatCount, where.repeatCount)
  }

  return result
}

// ─── Field application: datetime fields ──────────────────────────────────────

function applyDateTimeFields<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  where: NormalizedJobWhereInput
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (where.createdAt) {
    result = applyDateTimeFilter(result, COLUMN_MAP.createdAt, where.createdAt)
  }
  if (where.processAt) {
    result = applyDateTimeFilter(result, COLUMN_MAP.processAt, where.processAt)
  }
  if (where.processedAt) {
    result = applyDateTimeFilter(
      result,
      COLUMN_MAP.processedAt,
      where.processedAt
    )
  }
  if (where.completedAt) {
    result = applyDateTimeFilter(
      result,
      COLUMN_MAP.completedAt,
      where.completedAt
    )
  }
  if (where.failedAt) {
    result = applyDateTimeFilter(result, COLUMN_MAP.failedAt, where.failedAt)
  }
  if (where.cancelledAt) {
    result = applyDateTimeFilter(
      result,
      COLUMN_MAP.cancelledAt,
      where.cancelledAt
    )
  }

  return result
}

// ─── Field application: null-only fields ─────────────────────────────────────

function applyNullFields<DB, TB extends keyof DB>(
  query: SelectQueryBuilder<DB, TB, object>,
  where: NormalizedJobWhereInput
): SelectQueryBuilder<DB, TB, object> {
  let result = query

  if (where.cron) {
    result = applyNullFilter(result, COLUMN_MAP.cron, where.cron)
  }
  if (where.timeout) {
    result = applyNullFilter(result, COLUMN_MAP.timeout, where.timeout)
  }

  return result
}

// ─── Main: buildWhere ────────────────────────────────────────────────────────

/**
 * Apply `NormalizedJobWhereInput` conditions to a Kysely `SelectQueryBuilder`.
 *
 * Chains `.where()` calls for each filter field, mapping camelCase field names
 * to snake_case database columns. Handles AND/OR recursion using Kysely's
 * expression builder pattern.
 *
 * @param qb - A Kysely SelectQueryBuilder instance to apply conditions to
 * @param where - A normalized where input (use `normalizeWhere()` first)
 * @returns The query builder with all where conditions applied
 *
 * @example
 * ```typescript
 * import { buildWhere } from "@vorsteh-queue/query-builder/kysely"
 * import { normalizeWhere } from "@vorsteh-queue/query-builder"
 *
 * const normalized = normalizeWhere({ status: "pending", name: { contains: "email" } })
 * const query = buildWhere(
 *   db.selectFrom("queue_jobs").selectAll(),
 *   normalized
 * )
 * const jobs = await query.execute()
 * ```
 */
export function buildWhere<DB, TB extends keyof DB>(
  qb: SelectQueryBuilder<DB, TB, object>,
  where: NormalizedJobWhereInput
): SelectQueryBuilder<DB, TB, object> {
  let result = qb

  result = applyStringFields(result, where)
  result = applyNumericFields(result, where)
  result = applyDateTimeFields(result, where)
  result = applyNullFields(result, where)

  // AND recursion — recursively apply each AND clause
  if (where.AND) {
    for (const clause of where.AND) {
      result = buildWhere(result, clause)
    }
  }

  // OR recursion — use expression builder with eb.or([...])
  if (where.OR) {
    const orClauses = where.OR
    result = result.where((eb: ExpressionBuilder<DB, TB>) => {
      const expressions = orClauses.map((clause) =>
        eb.and(buildExpressions(eb, clause))
      )
      return eb.or(expressions)
    })
  }

  return result
}
