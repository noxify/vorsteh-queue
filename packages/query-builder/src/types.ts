// ─── Job Status (local definition to avoid circular dependency with core) ────

/**
 * All possible job statuses.
 * Mirrors the definition in `@vorsteh-queue/core` to avoid a circular dependency.
 */
export type JobStatus =
  | "pending"
  | "delayed"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "dead"
  | "waiting-children"

// ─── Filter Operators ─────────────────────────────────────────────────────────

/** String comparison operators */
export interface StringFilter {
  /** Exact match */
  readonly eq?: string
  /** Not equal */
  readonly neq?: string
  /** Contains substring */
  readonly contains?: string
  /** Starts with prefix */
  readonly startsWith?: string
  /** SQL LIKE pattern (use % for wildcards) */
  readonly like?: string
  /** Value is one of the provided strings */
  readonly in?: readonly string[]
  /** Check for null (true = is null, false = is not null) */
  readonly isNull?: boolean
}

/** Integer comparison operators */
export interface IntFilter {
  /** Exact match */
  readonly eq?: number
  /** Not equal */
  readonly neq?: number
  /** Less than */
  readonly lt?: number
  /** Less than or equal */
  readonly lte?: number
  /** Greater than */
  readonly gt?: number
  /** Greater than or equal */
  readonly gte?: number
  /** Check for null (true = is null, false = is not null) */
  readonly isNull?: boolean
}

/** DateTime comparison operators (accepts Date or ISO string) */
export interface DateTimeFilter {
  /** Before (exclusive) */
  readonly lt?: Date | string
  /** Before or at (inclusive) */
  readonly lte?: Date | string
  /** After (exclusive) */
  readonly gt?: Date | string
  /** After or at (inclusive) */
  readonly gte?: Date | string
  /** Check for null (true = is null, false = is not null) */
  readonly isNull?: boolean
}

/** Status-specific filter (single value or array) */
export interface JobStatusFilter {
  /** Exact status match */
  readonly eq?: JobStatus
  /** Not equal to status */
  readonly neq?: JobStatus
  /** Status is one of the provided values */
  readonly in?: readonly JobStatus[]
}

/** Null-check filter for optional fields */
export interface NullFilter {
  /** Check for null (true = is null, false = is not null) */
  readonly isNull?: boolean
}

// ─── Composite Where Input ────────────────────────────────────────────────────

/**
 * Flexible filter conditions for job queries.
 * All top-level conditions are AND'd by default.
 * Scalar values are accepted as shorthands for `{ eq: value }`.
 */
export interface JobWhereInput {
  // Logical operators (optional, for compound queries)
  /** Combine multiple conditions with logical AND */
  readonly AND?: readonly JobWhereInput[]
  /** Combine multiple conditions with logical OR */
  readonly OR?: readonly JobWhereInput[]

  // Identifiers & Names (shorthand: string value = { eq: value })
  /** Filter by job ID */
  readonly id?: StringFilter | string
  /** Filter by job name */
  readonly name?: StringFilter | string
  /** Filter by unique key */
  readonly uniqueKey?: StringFilter | string
  /** Filter by group key */
  readonly groupKey?: StringFilter | string

  // Status & State (shorthand: scalar = { eq: value })
  /** Filter by job status */
  readonly status?: JobStatusFilter | JobStatus
  /** Filter by job priority */
  readonly priority?: IntFilter | number
  /** Filter by number of attempts */
  readonly attempts?: IntFilter | number
  /** Filter by job progress */
  readonly progress?: IntFilter | number

  // Timestamps
  /** Filter by creation time */
  readonly createdAt?: DateTimeFilter
  /** Filter by scheduled processing time */
  readonly processAt?: DateTimeFilter
  /** Filter by actual processing time */
  readonly processedAt?: DateTimeFilter
  /** Filter by completion time */
  readonly completedAt?: DateTimeFilter
  /** Filter by failure time */
  readonly failedAt?: DateTimeFilter
  /** Filter by cancellation time */
  readonly cancelledAt?: DateTimeFilter

  // Scheduling
  /** Filter by presence of cron expression */
  readonly cron?: NullFilter
  /** Filter by repeat count */
  readonly repeatCount?: IntFilter | number
  /** Filter by presence of timeout */
  readonly timeout?: NullFilter

  // Flows & Dependencies
  /** Filter by flow ID */
  readonly flowId?: StringFilter | string
  /** Filter by parent ID (root jobs vs child jobs) */
  readonly parentId?: StringFilter | NullFilter | string
}

/**
 * Normalized version of JobWhereInput — all shorthand values expanded to full filter objects.
 * Produced by `normalizeWhere()` for consistent processing in adapters.
 */
export interface NormalizedJobWhereInput {
  /** Combine multiple conditions with logical AND */
  readonly AND?: readonly NormalizedJobWhereInput[]
  /** Combine multiple conditions with logical OR */
  readonly OR?: readonly NormalizedJobWhereInput[]

  // All fields use full filter objects (no scalar shorthands)
  /** Filter by job ID */
  readonly id?: StringFilter
  /** Filter by job name */
  readonly name?: StringFilter
  /** Filter by unique key */
  readonly uniqueKey?: StringFilter
  /** Filter by group key */
  readonly groupKey?: StringFilter
  /** Filter by job status */
  readonly status?: JobStatusFilter
  /** Filter by job priority */
  readonly priority?: IntFilter
  /** Filter by number of attempts */
  readonly attempts?: IntFilter
  /** Filter by job progress */
  readonly progress?: IntFilter
  /** Filter by creation time */
  readonly createdAt?: DateTimeFilter
  /** Filter by scheduled processing time */
  readonly processAt?: DateTimeFilter
  /** Filter by actual processing time */
  readonly processedAt?: DateTimeFilter
  /** Filter by completion time */
  readonly completedAt?: DateTimeFilter
  /** Filter by failure time */
  readonly failedAt?: DateTimeFilter
  /** Filter by cancellation time */
  readonly cancelledAt?: DateTimeFilter
  /** Filter by presence of cron expression */
  readonly cron?: NullFilter
  /** Filter by repeat count */
  readonly repeatCount?: IntFilter
  /** Filter by presence of timeout */
  readonly timeout?: NullFilter
  /** Filter by flow ID */
  readonly flowId?: StringFilter
  /** Filter by parent ID (root jobs vs child jobs) */
  readonly parentId?: StringFilter | NullFilter
}
