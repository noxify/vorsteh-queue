/**
 * Core type definitions for vorsteh-queue 1.0.
 *
 * This module contains all shared types used across Queue, Worker, and Adapter layers.
 */

import type { JobWhereInput } from "@vorsteh-queue/query-builder"

import type { Telemetry } from "./telemetry"

// ─── Job Status & State Machine ─────────────────────────────────────────────

/** All possible job statuses */
export type JobStatus =
  | "pending"
  | "delayed"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "dead"
  | "waiting-children"

/** Terminal statuses — jobs in these states are "done" */
export type TerminalStatus = "completed" | "cancelled" | "dead"

/** Active (non-terminal) statuses */
export type ActiveStatus =
  | "pending"
  | "delayed"
  | "processing"
  | "failed"
  | "waiting-children"

/**
 * Valid state transitions.
 * Key = current status, Value = array of allowed next statuses.
 */
export const STATE_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  cancelled: [],
  completed: [],
  dead: ["pending"],
  delayed: ["pending", "cancelled"],
  failed: ["pending", "dead", "cancelled"],
  pending: ["processing", "cancelled", "waiting-children"],
  processing: ["completed", "failed", "cancelled"],
  "waiting-children": ["pending", "cancelled", "failed"],
} as const

// ─── Serialized Error ────────────────────────────────────────────────────────

/** Serialized error format for consistent error storage and handling */
export interface SerializedError {
  readonly name: string
  readonly message: string
  readonly stack?: string
}

// ─── Step Types ──────────────────────────────────────────────────────────────

/** State of a single step within a multi-step job */
export interface StepState {
  readonly name: string
  readonly status: "pending" | "running" | "completed" | "failed" | "waiting"
  readonly result?: unknown
  readonly error?: SerializedError
  readonly startedAt?: Date
  readonly completedAt?: Date
  /** For waitFor steps: the event being waited on */
  readonly waitingFor?: string
}

/** Options for step.run() with optional compensation */
export interface StepRunOptions<TResult = unknown> {
  /** Compensation function invoked on failure (reverse saga) */
  readonly compensate?: (result: TResult) => Promise<void>
}

/** Options for step.waitFor() */
export interface WaitForOptions {
  /** Timeout duration (ms or string like "24h") — fails step if signal doesn't arrive */
  readonly timeout?: number | string
}

/** Context for multi-step job execution */
export interface StepContext {
  /** Execute a named step (idempotent — returns cached result on replay) */
  run: <TResult>(
    name: string,
    fn: () => Promise<TResult>,
    options?: StepRunOptions<TResult>
  ) => Promise<TResult>

  /** Pause execution for a duration (frees the worker) */
  sleep: (name: string, duration: string | number) => Promise<void>

  /** Pause execution until an external signal arrives */
  waitFor: <TData = unknown>(
    name: string,
    event: string,
    options?: WaitForOptions
  ) => Promise<TData>

  /** Run multiple steps in parallel */
  all: <TResults extends readonly unknown[]>(steps: {
    [K in keyof TResults]: Promise<TResults[K]>
  }) => Promise<TResults>
}

/** Trigger configuration for event-based job creation */
export interface TriggerConfig<TPayload = unknown, TResult = unknown> {
  /** Job name that triggers this */
  readonly on: string
  /** Job name to create */
  readonly create: string
  /** Transform completed job's result into new job's payload */
  readonly data: (result: TResult, job: Job<TPayload, TResult>) => unknown
  /** Optional condition — trigger only fires when this returns true */
  readonly condition?: (result: TResult) => boolean
  /** Optional job options for the created job */
  readonly options?: JobOptions
}

// ─── Flow Types ──────────────────────────────────────────────────────────────

/** A node in a flow tree (for addFlow input) */
export interface FlowJobDefinition {
  /** Job type name */
  readonly name: string
  /** Job payload */
  readonly payload: unknown
  /** Job options */
  readonly options?: JobOptions
  /** Whether parent should fail when this child fails
   * @default false
   */
  readonly failParentOnFailure?: boolean
  /** Child jobs (processed before this job) */
  readonly children?: readonly FlowJobDefinition[]
}

/** A node in a resolved flow tree (returned by getFlowTree) */
export interface FlowNode {
  /** The job at this node */
  readonly job: Job
  /** Child nodes */
  readonly children: readonly FlowNode[]
}

/** Result of addFlow */
export interface FlowResult {
  /** Flow ID (shared by all jobs in this tree) */
  readonly id: string
  /** The root (parent) job */
  readonly job: Job
}

// ─── Base Job Interface ──────────────────────────────────────────────────────

/**
 * Complete job record as stored and retrieved from the adapter.
 *
 * @template TPayload - Type of the job payload data
 * @template TResult - Type of the handler return value
 */
export interface Job<TPayload = unknown, TResult = unknown> {
  /** Unique job identifier (UUID) */
  readonly id: string
  /** Job type name — maps to a registered handler */
  readonly name: string
  /** Job payload data */
  readonly payload: TPayload
  /** Current job status */
  readonly status: JobStatus
  /** Priority (lower = higher priority)
   * @default 2
   */
  readonly priority: number
  /** Number of processing attempts so far */
  readonly attempts: number
  /** Maximum allowed attempts before moving to dead
   * @default 3
   */
  readonly maxAttempts: number
  /** When the job was created */
  readonly createdAt: Date
  /** Scheduled processing time (for delayed/cron jobs) */
  readonly processAt: Date
  /** When processing started */
  readonly processedAt?: Date
  /** When the job completed successfully */
  readonly completedAt?: Date
  /** When the job failed */
  readonly failedAt?: Date
  /** When the job was cancelled */
  readonly cancelledAt?: Date
  /** Serialized error from last failure */
  readonly error?: SerializedError
  /** Handler return value (only set when completed) */
  readonly result?: TResult
  /** Progress percentage (0-100) */
  readonly progress: number
  /** Cron expression for recurring jobs */
  readonly cron?: string
  /** Repeat interval in ms */
  readonly repeatEvery?: number
  /** Max repetitions allowed */
  readonly repeatLimit?: number
  /** Current repetition count */
  readonly repeatCount: number
  /** Timeout in ms, or false to disable
   * @default 30000
   */
  readonly timeout?: number | false
  /** Group key for FIFO ordering */
  readonly groupKey?: string
  /** Unique key for deduplication */
  readonly uniqueKey?: string
  /** Reason for cancellation */
  readonly cancellationReason?: string
  /** Job dependency IDs */
  readonly dependsOn?: readonly string[]
  /** Behavior when a dependency fails
   * @default "fail"
   */
  readonly onDependencyFailure?: "fail" | "cancel"
  /** Step execution state */
  readonly steps?: readonly StepState[]
  /** Received signals for waitFor steps */
  readonly signals?: Readonly<Record<string, unknown>>
  /** Parent job ID (for flow trees) */
  readonly parentId?: string
  /** Flow ID shared by all jobs in the same flow tree */
  readonly flowId?: string
  /** Number of direct children in this flow node */
  readonly childrenCount?: number
  /** Number of completed children */
  readonly childrenCompleted?: number
  /** If true, this job fails when any child fails */
  readonly failParentOnFailure?: boolean
}

// ─── Job Options ─────────────────────────────────────────────────────────────

/** Options for configuring job behavior when adding to queue */
export interface JobOptions {
  /** Job priority (lower = higher priority)
   * @default 2
   */
  readonly priority?: number
  /** Delay in ms before job becomes available */
  readonly delay?: number
  /** Specific date/time for processing */
  readonly runAt?: Date
  /** Cron expression for recurring execution */
  readonly cron?: string
  /** Recurring job configuration */
  readonly repeat?: {
    /** Interval in ms between runs */
    readonly every: number
    /** Max repetitions (unlimited if omitted) */
    readonly limit?: number
  }
  /** Max retry attempts
   * @default 3
   */
  readonly maxAttempts?: number
  /** Timeout in ms, or false to disable
   * @default 30000
   */
  readonly timeout?: number | false
  /** IANA timezone for scheduling
   * @default "UTC"
   */
  readonly timezone?: string
  /** Group key for FIFO ordering within this group */
  readonly group?: string
  /** Unique job configuration */
  readonly unique?: {
    /** Deduplication key */
    readonly key: string
    /** Behavior when duplicate exists
     * @default "reject"
     */
    readonly action: "reject" | "replace"
  }
  /** Job IDs that must complete before this job is processed */
  readonly dependsOn?: readonly string[]
  /** Behavior when a dependency fails
   * @default "fail"
   */
  readonly onDependencyFailure?: "fail" | "cancel"
}

// ─── Queue Configuration ─────────────────────────────────────────────────────

/** Configuration options for the Queue (producer) */
export interface QueueConfig {
  /** Queue name for isolation
   * @default "default"
   */
  readonly name: string
  /** Default job options applied to all jobs */
  readonly defaultJobOptions?: Partial<JobOptions>
  /** Optional telemetry instance for observability
   * @default noopTelemetry
   */
  readonly telemetry?: Telemetry
  /** Remove completed jobs: true = immediate, number = keep N
   * @default 100
   */
  readonly removeOnComplete?: boolean | number
  /** Remove failed jobs: true = immediate, number = keep N
   * @default 50
   */
  readonly removeOnFail?: boolean | number
  /** Dead-letter queue configuration */
  readonly deadLetterQueue?: {
    /** Enable DLQ (jobs move to `dead` after maxAttempts)
     * @default true
     */
    readonly enabled: boolean
  }
}

// ─── Worker Configuration ────────────────────────────────────────────────────

/** Configuration options for the Worker (consumer) */
export interface WorkerConfig {
  /** Queue name to consume from */
  readonly name: string
  /** Max concurrent jobs for this Worker
   * @default 1
   */
  readonly concurrency?: number
  /** Polling interval in ms
   * @default 100
   */
  readonly pollInterval?: number
  /** Optional telemetry instance for observability
   * @default noopTelemetry
   */
  readonly telemetry?: Telemetry
  /** Retry strategy configuration */
  readonly retryStrategy?: RetryStrategyConfig
  /** Remove completed jobs: true = immediate, number = keep N
   * @default 100
   */
  readonly removeOnComplete?: boolean | number
  /** Remove failed jobs: true = immediate, number = keep N
   * @default 50
   */
  readonly removeOnFail?: boolean | number
}

// ─── Retry Strategy ──────────────────────────────────────────────────────────

/** Configuration for retry delay calculation */
export type RetryStrategyConfig =
  | {
      /** Backoff type
       * @default "exponential"
       */
      readonly type: "exponential" | "linear" | "fixed"
      /** Base delay in ms
       * @default 1000
       */
      readonly delay: number
      /** Max delay in ms
       * @default 30000
       */
      readonly maxDelay: number
    }
  | ((attempts: number) => number)

// ─── Handler Types ───────────────────────────────────────────────────────────

/** Context passed to job handlers */
export interface JobContext {
  /** Abort signal — triggered on timeout or cancellation */
  readonly signal: AbortSignal
  /** Step API for multi-step jobs (Phase 2) */
  readonly step: StepContext
  /** Get results of children jobs (for parent jobs in flows) */
  readonly getChildrenResults?: () => Promise<ReadonlyMap<string, unknown>>
}

/** Single job handler function */
export type JobHandler<TPayload = unknown, TResult = unknown> = (
  job: JobWithProgress<TPayload, TResult>,
  ctx: JobContext
) => Promise<TResult>

/** Batch job handler function */
export type BatchJobHandler<TPayload = unknown, TResult = unknown> = (
  jobs: readonly JobWithProgress<TPayload, TResult>[],
  ctx: JobContext
) => Promise<TResult[]>

/** Job with progress update method */
export interface JobWithProgress<
  TPayload = unknown,
  TResult = unknown,
> extends Job<TPayload, TResult> {
  /** Update job progress (0-100) */
  updateProgress: (value: number) => Promise<void>
}

/** Handler registration options (on Worker) */
export interface HandlerOptions {
  /** Per-handler concurrency limit */
  readonly concurrency?: number
  /** Per-handler rate limit (Phase 2) */
  readonly rateLimit?: {
    readonly max: number
    readonly duration: number
  }
}

/** Batch handler registration options */
export interface BatchHandlerOptions extends HandlerOptions {
  /** Min jobs before batch is processed
   * @default 1
   */
  readonly minSize?: number
  /** Max jobs per batch
   * @default 10
   */
  readonly maxSize?: number
  /** Max wait time in ms before processing partial batch
   * @default 30000
   */
  readonly waitFor?: number
}

// ─── Event Types ─────────────────────────────────────────────────────────────

/** Events emitted by the Queue (producer) */
export interface QueueEvents {
  /** Emitted when a job is added to the queue */
  "job:added": Job
  /** Emitted when a job starts processing */
  "job:processing": Job
  /** Emitted when a job completes successfully */
  "job:completed": Job
  /** Emitted when a job fails (may retry) */
  "job:failed": Job & { error: SerializedError }
  /** Emitted when a job is cancelled */
  "job:cancelled": Job & { cancellationReason?: string }
  /** Emitted when a job is retried */
  "job:retried": Job
  /** Emitted when job progress is updated */
  "job:progress": Job & { progress: number }
  /** Emitted when a job moves to dead-letter queue */
  "job:dead": Job
}

/** Events emitted by the Worker (consumer) */
export interface WorkerEvents {
  /** Emitted when worker starts */
  "worker:started": undefined
  /** Emitted when worker stops */
  "worker:stopped": undefined
  /** Emitted on unexpected worker error */
  "worker:error": unknown
  /** Emitted when a job starts processing */
  "job:processing": Job
  /** Emitted when a job completes successfully */
  "job:completed": Job
  /** Emitted when a job fails (may retry) */
  "job:failed": Job & { error: SerializedError }
  /** Emitted when a job is cancelled */
  "job:cancelled": Job & { cancellationReason?: string }
  /** Emitted when a job is retried */
  "job:retried": Job
  /** Emitted when job progress is updated */
  "job:progress": Job & { progress: number }
  /** Emitted when a job moves to dead-letter queue */
  "job:dead": Job
  /** Emitted when a batch starts processing */
  "batch:processing": readonly Job[]
  /** Emitted when a batch completes successfully */
  "batch:completed": readonly Job[]
  /** Emitted when a batch fails */
  "batch:failed": { jobs: readonly Job[]; error: SerializedError }
}

// ─── Queue Stats ─────────────────────────────────────────────────────────────

/** Job counts by status */
export interface QueueStats {
  readonly pending: number
  readonly delayed: number
  readonly processing: number
  readonly completed: number
  readonly failed: number
  readonly cancelled: number
  readonly dead: number
  readonly "waiting-children": number
}

// ─── Adapter Types ───────────────────────────────────────────────────────────

/** Input for creating a new job (no id/createdAt/timestamps) */
export type NewJob = Omit<
  Job,
  | "id"
  | "createdAt"
  | "processedAt"
  | "completedAt"
  | "failedAt"
  | "cancelledAt"
  | "error"
  | "result"
>

/** Options for getNextJob */
export interface GetNextJobOptions {
  /** Handler names registered on this Worker */
  readonly handlerNames: readonly string[]
  /** Group keys currently being processed (to exclude) */
  readonly activeGroups: readonly string[]
}

/** Status update payload */
export interface JobStatusUpdate {
  readonly status: JobStatus
  readonly error?: SerializedError
  readonly result?: unknown
  readonly processAt?: Date
  readonly cancellationReason?: string
}

/** Filter for bulk cancellation */
export interface CancelJobsFilter {
  readonly name?: string
  readonly status?: ActiveStatus
  readonly group?: string
}

/** Pagination options */
export interface PaginationOptions {
  readonly limit?: number
  readonly offset?: number
}

// ─── Adapter Interface ───────────────────────────────────────────────────────

/**
 * Interface that all queue adapters must implement.
 * Provides database-agnostic job storage and retrieval.
 */
export interface QueueAdapter {
  /** Connect to storage backend */
  connect: () => Promise<void>

  /** Disconnect from storage backend */
  disconnect: () => Promise<void>

  /** Set the queue name for isolation (called during init) */
  setQueueName: (name: string) => void

  // ─── Job CRUD ───────────────────────────────────────────────

  /** Add a single job */
  addJob: (job: NewJob) => Promise<Job>

  /** Add multiple jobs atomically */
  addJobs: (jobs: readonly NewJob[]) => Promise<readonly Job[]>

  /** Get a job by ID */
  getJobById: (id: string) => Promise<Job | null>

  // ─── Job Picking (Worker) ──────────────────────────────────

  /**
   * Get the next available job respecting priority, groups, and handlers.
   * Must use FOR UPDATE SKIP LOCKED (or equivalent) in DB adapters.
   */
  getNextJob: (options: GetNextJobOptions) => Promise<Job | null>

  /** Get multiple jobs for a batch handler */
  getNextJobsForHandler: (
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ) => Promise<readonly Job[]>

  // ─── Status Updates ────────────────────────────────────────

  /** Transition job to a new status with optional metadata */
  updateJobStatus: (id: string, update: JobStatusUpdate) => Promise<void>

  /** Increment job attempt counter */
  incrementJobAttempts: (id: string) => Promise<void>

  /** Update job progress (0-100) */
  updateJobProgress: (id: string, progress: number) => Promise<void>

  // ─── Cancellation ──────────────────────────────────────────

  /** Cancel a single job (must be in cancellable state) */
  cancelJob: (id: string, reason?: string) => Promise<boolean>

  /** Cancel multiple jobs matching a filter */
  cancelJobs: (filter: CancelJobsFilter) => Promise<number>

  // ─── Dead-Letter Queue ─────────────────────────────────────

  /** Get dead jobs with pagination */
  getDeadJobs: (options?: PaginationOptions) => Promise<readonly Job[]>

  /** Redrive a dead job back to pending */
  redriveJob: (id: string) => Promise<void>

  /** Redrive multiple dead jobs */
  redriveJobs: (filter?: { name?: string }) => Promise<number>

  // ─── Statistics & Queries ──────────────────────────────────

  /** Get job counts by status */
  getQueueStats: () => Promise<QueueStats>

  /** Get job count — returns all pending + delayed jobs when no filter provided, or count of jobs matching the where filter */
  size: (where?: JobWhereInput) => Promise<number>

  /** Get paginated job list with optional where filter */
  getJobs: (options: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }) => Promise<readonly Job[]>

  /** Get paginated list of flows (root jobs that have a flowId) */
  getFlows: (options?: PaginationOptions) => Promise<
    readonly {
      flowId: string
      rootJob: Job
    }[]
  >

  // ─── Cleanup ───────────────────────────────────────────────

  /** Delete jobs by status */
  clearJobs: (status?: JobStatus) => Promise<number>

  /** Keep only N most recent jobs of a given status */
  cleanupJobs: (status: JobStatus, keepCount: number) => Promise<number>

  // ─── Unique Jobs ───────────────────────────────────────────

  /** Check if a job with the given unique key exists in active state */
  findJobByUniqueKey: (uniqueKey: string) => Promise<Job | null>

  // ─── Single Job Operations ─────────────────────────────────

  /** Retry a failed job (reset to pending, clear error, reset attempts) */
  retryJob: (id: string) => Promise<boolean>

  /** Promote a delayed job to run immediately (set processAt to now) */
  runJobNow: (id: string) => Promise<boolean>

  /** Delete a single job by ID */
  deleteJob: (id: string) => Promise<boolean>

  // ─── Transactions ──────────────────────────────────────────

  /** Execute operations within a transaction */
  transaction: <TResult>(fn: () => Promise<TResult>) => Promise<TResult>

  // ─── Steps (Phase 2) ───────────────────────────────────────

  /** Update the steps state on a job */
  updateJobSteps: (id: string, steps: readonly StepState[]) => Promise<void>

  /** Store a signal on a job and promote it to pending (for waitFor) */
  setJobSignal: (id: string, event: string, data: unknown) => Promise<boolean>

  // ─── Flows ─────────────────────────────────────────────────

  /** Get all jobs in a flow as a tree */
  getFlowTree: (flowId: string) => Promise<FlowNode | null>

  /** Increment children_completed on a parent job. Returns updated counts. */
  incrementChildrenCompleted: (
    parentId: string
  ) => Promise<{ completed: number; total: number }>

  /** Get all direct children of a job */
  getChildrenJobs: (parentId: string) => Promise<readonly Job[]>
}

// ─── Adapter Props ───────────────────────────────────────────────────────────

/** Prisma adapter configuration */
export interface PrismaAdapterProps {
  /** Model name in the `schema.prisma` file
   * @default "QueueJob"
   */
  modelName?: string
  /** Table name in the database
   * @default "queue_jobs"
   */
  tableName?: string
  /** Schema name in the database
   * @default undefined (uses default schema `public`)
   */
  schemaName?: string
}

/** Kysely adapter configuration */
export interface KyselyAdapterProps {
  /** Table name in the database
   * @default "queue_jobs"
   */
  tableName?: string
  /** Schema name in the database
   * @default "public"
   */
  schemaName?: string
}

/** Drizzle adapter configuration */
export interface DrizzleAdapterProps {
  /** Export name in the `schema.ts` file
   * @default "queueJobs"
   */
  modelName?: string
}

/** ZenStack adapter configuration */
export interface ZenstackAdapterProps {
  /** Model name used in the ZenStack client (camelCase accessor)
   * @default "queueJob"
   */
  modelName?: string
  /** Table name in the database
   * @default "queue_jobs"
   */
  tableName?: string
  /** Schema name in the database
   * @default undefined (uses default schema `public`)
   */
  schemaName?: string
}

/** TypeORM adapter configuration */
export interface TypeormAdapterProps {
  /** Table name in the database
   * @default "queue_jobs"
   */
  tableName?: string
  /** Schema name in the database
   * @default undefined (uses default schema `public`)
   */
  schemaName?: string
}

/** MikroORM adapter configuration */
export interface MikroormAdapterProps {
  /** Table name in the database
   * @default "queue_jobs"
   */
  tableName?: string
  /** Schema name in the database
   * @default undefined (uses default schema `public`)
   */
  schemaName?: string
}

/** Sequelize adapter configuration */
export interface SequelizeAdapterProps {
  /** Table name in the database
   * @default "queue_jobs"
   */
  tableName?: string
  /** Schema name in the database
   * @default undefined (uses default schema `public`)
   */
  schemaName?: string
}

/** Adapter kind discriminator */
export type AdapterKind =
  | "prisma"
  | "drizzle"
  | "kysely"
  | "zenstack"
  | "typeorm"
  | "mikroorm"
  | "sequelize"

/** Adapter props by kind */
export type AdapterProps<T extends AdapterKind> = T extends "prisma"
  ? PrismaAdapterProps
  : T extends "kysely"
    ? KyselyAdapterProps
    : T extends "drizzle"
      ? DrizzleAdapterProps
      : T extends "zenstack"
        ? ZenstackAdapterProps
        : T extends "typeorm"
          ? TypeormAdapterProps
          : T extends "mikroorm"
            ? MikroormAdapterProps
            : T extends "sequelize"
              ? SequelizeAdapterProps
              : never
