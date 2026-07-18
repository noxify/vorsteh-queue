import type {
  DateTimeFilter,
  IntFilter,
  JobStatusFilter,
  NormalizedJobWhereInput,
  NullFilter,
  StringFilter,
} from "./types"

// ─── Local Job Type ───────────────────────────────────────────────────────────

/**
 * Minimal job record shape used for in-memory matching.
 * Avoids importing from `@vorsteh-queue/core` to prevent circular dependencies.
 */
interface JobRecord {
  readonly id: string
  readonly name: string
  readonly status: string
  readonly priority: number
  readonly attempts: number
  readonly progress: number
  readonly createdAt: Date
  readonly processAt: Date
  readonly processedAt?: Date
  readonly completedAt?: Date
  readonly failedAt?: Date
  readonly cancelledAt?: Date
  readonly cron?: string
  readonly repeatCount: number
  readonly timeout?: number | false
  readonly groupKey?: string
  readonly uniqueKey?: string
  readonly flowId?: string
  readonly parentId?: string
}

// ─── LIKE Pattern Matching ────────────────────────────────────────────────────

/**
 * Convert a SQL LIKE pattern to a regular expression.
 *
 * - `%` matches any sequence of characters (including empty)
 * - `_` matches exactly one character
 * - All other regex-special characters are escaped
 *
 * @param pattern - SQL LIKE pattern string
 * @returns A RegExp that performs the equivalent match
 */
function likePatternToRegex(pattern: string): RegExp {
  let result = ""
  for (const char of pattern) {
    if (char === "%") {
      result += ".*"
    } else if (char === "_") {
      result += "."
    } else if (/[.*+?^${}()|[\]\\]/.test(char)) {
      result += `\\${char}`
    } else {
      result += char
    }
  }
  return new RegExp(`^${result}$`)
}

// ─── Null Checking Helper ─────────────────────────────────────────────────────

/**
 * Determine whether a value is considered "null" for filtering purposes.
 * `undefined` and `null` are null; `false` (e.g. timeout) is not null.
 */
function isNullish(value: unknown): boolean {
  return value === undefined || value === null
}

// ─── String Filter Matching ───────────────────────────────────────────────────

function matchesStringFilter(
  value: string | undefined | null,
  filter: StringFilter
): boolean {
  if (filter.isNull === true) {
    return isNullish(value)
  }
  if (filter.isNull === false) {
    return !isNullish(value)
  }

  // If value is null/undefined and we're not checking isNull, fail non-null comparisons
  if (isNullish(value)) {
    return false
  }
  const v = value as string

  if (filter.eq !== undefined && v !== filter.eq) {
    return false
  }
  if (filter.neq !== undefined && v === filter.neq) {
    return false
  }
  if (filter.contains !== undefined && !v.includes(filter.contains)) {
    return false
  }
  if (filter.startsWith !== undefined && !v.startsWith(filter.startsWith)) {
    return false
  }
  if (filter.like !== undefined && !likePatternToRegex(filter.like).test(v)) {
    return false
  }
  if (filter.in !== undefined && !filter.in.includes(v)) {
    return false
  }

  return true
}

// ─── Int Filter Matching ──────────────────────────────────────────────────────

function matchesIntFilter(
  value: number | undefined | null,
  filter: IntFilter
): boolean {
  if (filter.isNull === true) {
    return isNullish(value)
  }
  if (filter.isNull === false) {
    return !isNullish(value)
  }

  if (isNullish(value)) {
    return false
  }
  const v = value as number

  if (filter.eq !== undefined && v !== filter.eq) {
    return false
  }
  if (filter.neq !== undefined && v === filter.neq) {
    return false
  }
  if (filter.lt !== undefined && v >= filter.lt) {
    return false
  }
  if (filter.lte !== undefined && v > filter.lte) {
    return false
  }
  if (filter.gt !== undefined && v <= filter.gt) {
    return false
  }
  if (filter.gte !== undefined && v < filter.gte) {
    return false
  }

  return true
}

// ─── DateTime Filter Matching ─────────────────────────────────────────────────

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

function matchesDateTimeFilter(
  value: Date | undefined | null,
  filter: DateTimeFilter
): boolean {
  if (filter.isNull === true) {
    return isNullish(value)
  }
  if (filter.isNull === false) {
    return !isNullish(value)
  }

  if (isNullish(value)) {
    return false
  }
  const v = value as Date
  const ms = v.getTime()

  if (filter.lt !== undefined && ms >= toDate(filter.lt).getTime()) {
    return false
  }
  if (filter.lte !== undefined && ms > toDate(filter.lte).getTime()) {
    return false
  }
  if (filter.gt !== undefined && ms <= toDate(filter.gt).getTime()) {
    return false
  }
  if (filter.gte !== undefined && ms < toDate(filter.gte).getTime()) {
    return false
  }

  return true
}

// ─── JobStatus Filter Matching ────────────────────────────────────────────────

function matchesJobStatusFilter(
  value: string,
  filter: JobStatusFilter
): boolean {
  if (filter.eq !== undefined && value !== filter.eq) {
    return false
  }
  if (filter.neq !== undefined && value === filter.neq) {
    return false
  }
  if (filter.in !== undefined && !filter.in.includes(value as never)) {
    return false
  }

  return true
}

// ─── NullFilter Matching ──────────────────────────────────────────────────────

function matchesNullFilter(value: unknown, filter: NullFilter): boolean {
  if (filter.isNull === true) {
    return isNullish(value)
  }
  if (filter.isNull === false) {
    return !isNullish(value)
  }
  return true
}

// ─── Field Value Extraction ───────────────────────────────────────────────────

/**
 * Get the value for `timeout` null-checking.
 * The job type has `timeout` as `number | false | undefined`.
 * For `isNull` checking: `false` → not null, `undefined` → null.
 */
function getTimeoutNullValue(job: JobRecord): unknown {
  return job.timeout === undefined ? undefined : job.timeout
}

// ─── Top-Level Condition Matching (split by field group to reduce complexity) ─

function matchesStringFields(
  job: JobRecord,
  where: NormalizedJobWhereInput
): boolean {
  if (where.id && !matchesStringFilter(job.id, where.id)) {
    return false
  }
  if (where.name && !matchesStringFilter(job.name, where.name)) {
    return false
  }
  if (where.uniqueKey && !matchesStringFilter(job.uniqueKey, where.uniqueKey)) {
    return false
  }
  if (where.groupKey && !matchesStringFilter(job.groupKey, where.groupKey)) {
    return false
  }
  if (where.flowId && !matchesStringFilter(job.flowId, where.flowId)) {
    return false
  }
  return true
}

function matchesParentIdField(
  job: JobRecord,
  where: NormalizedJobWhereInput
): boolean {
  if (!where.parentId) {
    return true
  }
  const parentFilter = where.parentId
  // If it only has `isNull`, treat as NullFilter; otherwise treat as StringFilter
  if ("isNull" in parentFilter && Object.keys(parentFilter).length === 1) {
    return matchesNullFilter(job.parentId, parentFilter as NullFilter)
  }
  return matchesStringFilter(job.parentId, parentFilter as StringFilter)
}

function matchesIntFields(
  job: JobRecord,
  where: NormalizedJobWhereInput
): boolean {
  if (where.priority && !matchesIntFilter(job.priority, where.priority)) {
    return false
  }
  if (where.attempts && !matchesIntFilter(job.attempts, where.attempts)) {
    return false
  }
  if (where.progress && !matchesIntFilter(job.progress, where.progress)) {
    return false
  }
  if (
    where.repeatCount &&
    !matchesIntFilter(job.repeatCount, where.repeatCount)
  ) {
    return false
  }
  return true
}

function matchesDateTimeFields(
  job: JobRecord,
  where: NormalizedJobWhereInput
): boolean {
  if (
    where.createdAt &&
    !matchesDateTimeFilter(job.createdAt, where.createdAt)
  ) {
    return false
  }
  if (
    where.processAt &&
    !matchesDateTimeFilter(job.processAt, where.processAt)
  ) {
    return false
  }
  if (
    where.processedAt &&
    !matchesDateTimeFilter(job.processedAt, where.processedAt)
  ) {
    return false
  }
  if (
    where.completedAt &&
    !matchesDateTimeFilter(job.completedAt, where.completedAt)
  ) {
    return false
  }
  if (where.failedAt && !matchesDateTimeFilter(job.failedAt, where.failedAt)) {
    return false
  }
  if (
    where.cancelledAt &&
    !matchesDateTimeFilter(job.cancelledAt, where.cancelledAt)
  ) {
    return false
  }
  return true
}

function matchesNullFields(
  job: JobRecord,
  where: NormalizedJobWhereInput
): boolean {
  if (where.cron && !matchesNullFilter(job.cron, where.cron)) {
    return false
  }
  if (
    where.timeout &&
    !matchesNullFilter(getTimeoutNullValue(job), where.timeout)
  ) {
    return false
  }
  return true
}

function matchesConditions(
  job: JobRecord,
  where: NormalizedJobWhereInput
): boolean {
  if (!matchesStringFields(job, where)) {
    return false
  }
  if (!matchesParentIdField(job, where)) {
    return false
  }
  if (where.status && !matchesJobStatusFilter(job.status, where.status)) {
    return false
  }
  if (!matchesIntFields(job, where)) {
    return false
  }
  if (!matchesDateTimeFields(job, where)) {
    return false
  }
  if (!matchesNullFields(job, where)) {
    return false
  }
  return true
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Check whether a job matches a normalized where filter.
 *
 * Supports all filter operators (eq, neq, contains, startsWith, like, in,
 * lt, lte, gt, gte, isNull) and recursive AND/OR compound conditions.
 * Top-level conditions are implicitly AND'd.
 *
 * @param job - The job record to test against the filter
 * @param where - A normalized filter (produced by `normalizeWhere()`)
 * @returns `true` if the job satisfies all filter conditions
 *
 * @example
 * ```typescript
 * import { matchesWhere } from "@vorsteh-queue/query-builder"
 *
 * const matches = matchesWhere(job, {
 *   status: { eq: "pending" },
 *   priority: { lte: 2 },
 *   OR: [
 *     { name: { contains: "email" } },
 *     { name: { contains: "sms" } },
 *   ],
 * })
 * ```
 */
export function matchesWhere(
  job: JobRecord,
  where: NormalizedJobWhereInput
): boolean {
  // Check AND clauses (all must match, short-circuit on first false)
  if (where.AND) {
    for (const clause of where.AND) {
      if (!matchesWhere(job, clause)) {
        return false
      }
    }
  }

  // Check OR clauses (at least one must match, short-circuit on first true)
  if (where.OR) {
    let anyMatch = false
    for (const clause of where.OR) {
      if (matchesWhere(job, clause)) {
        anyMatch = true
        break
      }
    }
    if (!anyMatch) {
      return false
    }
  }

  // Check all top-level field conditions (implicit AND)
  return matchesConditions(job, where)
}
