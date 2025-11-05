export type MaybePromise<T> = T | Promise<T>

/**
 * BatchJob: BaseJob without scheduling fields (cron, repeat, delay, processAt)
 */
export type BatchJob<TJobPayload = unknown, TJobResult = unknown> = Omit<
  BaseJob<TJobPayload, TJobResult>,
  "cron" | "repeatEvery" | "repeatLimit" | "repeatCount" | "processAt"
>

/**
 * Function type for batch job handlers.
 *
 * @template TJobPayload Type of job payload
 * @template TJobResult Type of return value
 */
export type BatchJobHandler<TJobPayload = unknown, TJobResult = unknown> = (
  jobs: BatchJobWithProgress<TJobPayload, TJobResult>[],
) => MaybePromise<TJobResult[]>

/**
 * Batch job interface with progress update capability.
 *
 * @template TJobPayload Type of the job payload
 * @template TJobResult Type of the job result
 */
export interface BatchJobWithProgress<TJobPayload = unknown, TJobResult = unknown>
  extends BaseJob<TJobPayload, TJobResult> {
  updateProgress(value: number): Promise<void>
}
// Using built-in TypeScript utility instead of type-fest
type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Serialized error format for consistent error storage and handling.
 */
export interface SerializedError {
  name: string
  message: string
  stack?: string
}

/** Job processing status */
export type JobStatus = "pending" | "processing" | "completed" | "failed" | "delayed"

/** Job priority (lower number = higher priority) */
export type JobPriority = number

/**
 * Base job interface containing all job metadata and payload.
 *
 * @template TJobPayload Type of the job payload
 * @template TJobResult Type of the job result
 */
export interface BaseJob<TJobPayload = unknown, TJobResult = unknown> {
  /** Unique identifier for the job */
  readonly id: string
  /** Job type name used for handler registration */
  readonly name: string
  /** Job data to be processed by the handler */
  readonly payload: TJobPayload
  /** Current processing status of the job */
  readonly status: JobStatus
  /** Job priority (lower number = higher priority) */
  readonly priority: JobPriority
  /** Number of times this job has been attempted */
  readonly attempts: number
  /** Maximum number of retry attempts allowed */
  readonly maxAttempts: number
  /** When the job was created */
  readonly createdAt: Date
  /** When the job should be processed (for delayed jobs) */
  readonly processAt: Date
  /** When job processing started */
  readonly processedAt?: Date
  /** When the job completed successfully */
  readonly completedAt?: Date
  /** When the job failed permanently */
  readonly failedAt?: Date
  /** Error message if the job failed */
  readonly error?: SerializedError
  /** Result returned by the job handler (only available for completed jobs) */
  readonly result?: TJobResult
  /** Current progress percentage (0-100) */
  readonly progress?: number
  /** Cron expression for recurring jobs */
  readonly cron?: string
  /** Interval in milliseconds for recurring jobs */
  readonly repeatEvery?: number
  /** Maximum number of repetitions for recurring jobs */
  readonly repeatLimit?: number
  /** Current repetition count for recurring jobs */
  readonly repeatCount?: number
  /** Job timeout in milliseconds or false to disable */
  readonly timeout?: number | false
}

/**
 * Options for configuring job behavior when adding to queue.
 */
export interface JobOptions {
  /** Job priority (lower number = higher priority, default: 2) */
  readonly priority?: JobPriority
  /** Delay in milliseconds before job becomes available for processing */
  readonly delay?: number
  /** Specific date/time when job should be processed */
  readonly runAt?: Date
  /** Cron expression for recurring jobs (e.g., "0 9 * * *" for daily at 9 AM) */
  readonly cron?: string
  /** Recurring job configuration */
  readonly repeat?: {
    /** Interval in milliseconds between repetitions */
    every: number
    /** Maximum number of repetitions (unlimited if not specified) */
    limit?: number
  }
  /** Maximum number of retry attempts (default: 3) */
  readonly maxAttempts?: number
  /** Job timeout in milliseconds or false to disable (default: 30000) */
  readonly timeout?: number | false
  /** Timezone for job scheduling (default: UTC) */
  readonly timezone?: string
}

/**
 * Configuration options for queue behavior.
 */
export interface QueueConfig {
  /** Name of the queue for identification and isolation */
  readonly name: string
  /** Maximum number of jobs to process simultaneously (default: 1) */
  readonly concurrency?: number
  /** Default options applied to all jobs unless overridden */
  readonly defaultJobOptions?: JobOptions
  /** Base delay in milliseconds before retrying failed jobs (default: 1000) */
  readonly retryDelay?: number
  /** Maximum delay in milliseconds for exponential backoff (default: 30000) */
  readonly maxRetryDelay?: number
  /** Remove completed jobs: true = immediate, false = keep all, number = keep N jobs (default: 100) */
  readonly removeOnComplete?: boolean | number
  /** Remove failed jobs: true = immediate, false = keep all, number = keep N jobs (default: 50) */
  readonly removeOnFail?: boolean | number
  /** Interval in milliseconds between queue polling cycles (default: 100) */
  readonly pollInterval?: number
  /** Delay in milliseconds between processing individual jobs (default: 10) */
  readonly jobInterval?: number

  /** Batch processing configuration (optional) */
  readonly batch?: {
    /** Minimum number of jobs before a batch is processed (default: 1) */
    minSize?: number
    /** Maximum number of jobs per batch (default: 10) */
    maxSize?: number
    /** Maximum wait time in ms before processing a batch, even if minSize is not reached (default: 30000) */
    waitFor?: number
  }
}

/**
 * Queue statistics showing job counts by status.
 */
export interface QueueStats {
  /** Number of jobs waiting to be processed */
  readonly pending: number
  /** Number of jobs currently being processed */
  readonly processing: number
  /** Number of jobs that completed successfully */
  readonly completed: number
  /** Number of jobs that failed permanently */
  readonly failed: number
  /** Number of jobs scheduled for future processing */
  readonly delayed: number
}

/**
 * Function type for job handlers.
 *
 * @template TJobPayload Type of job payload
 * @template TJobResult Type of return value
 */
export type JobHandler<TJobPayload = unknown, TJobResult = unknown> = (
  job: JobWithProgress<TJobPayload, TJobResult>,
) => Promise<TJobResult>

/**
 * Job interface with progress update capability.
 *
 * @template TJobPayload Type of the job payload
 * @template TJobResult Type of the job result
 */
export interface JobWithProgress<TJobPayload = unknown, TJobResult = unknown>
  extends BaseJob<TJobPayload, TJobResult> {
  updateProgress(value: number): Promise<void>
}

/**
 * Interface that all queue adapters must implement.
 * Provides database-agnostic job storage and retrieval.
 */
export interface QueueAdapter {
  /** Retrieve up to `count` jobs for a specific handler (job name) for batch processing */
  getNextJobsForHandler(handlerName: string, count: number): Promise<BatchJob[]>
  connect(): Promise<void>
  disconnect(): Promise<void>

  addJob<TJobPayload, TJobResult = unknown>(
    job: Omit<BaseJob<TJobPayload, TJobResult>, "id" | "createdAt">,
  ): Promise<BaseJob<TJobPayload, TJobResult>>

  /** Add multiple jobs in a single batch operation */
  addJobs<TJobPayload, TJobResult = unknown>(
    jobs: Omit<BatchJob<TJobPayload, TJobResult>, "id" | "createdAt">[],
  ): Promise<BatchJob<TJobPayload, TJobResult>[]>

  getNextJob(): Promise<BaseJob | null>
  updateJobStatus(id: string, status: JobStatus, error?: unknown, result?: unknown): Promise<void>
  updateJobProgress(id: string, progress: number): Promise<void>
  incrementJobAttempts(id: string): Promise<void>

  getQueueStats(): Promise<QueueStats>
  clearJobs(status?: JobStatus): Promise<number>
  cleanupJobs(status: JobStatus, keepCount: number): Promise<number>
  size(): Promise<number>

  transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult>

  /** @internal Set the queue name for job isolation */
  setQueueName(queueName: string): void
}

/**
 * Events emitted by the queue during job processing.
 */
export interface QueueEvents {
  /** Emitted when a batch of jobs is about to be processed */
  "batch:processing": BaseJob[]
  /** Emitted when a batch of jobs completes successfully */
  "batch:completed": BaseJob[]
  /** Emitted when a batch of jobs fails (includes error) */
  "batch:failed": { jobs: BaseJob[]; error: SerializedError }
  /** Emitted when a job is added to the queue */
  "job:added": BaseJob
  /** Emitted when a job starts processing */
  "job:processing": BaseJob
  /** Emitted when a job completes successfully */
  "job:completed": BaseJob
  /** Emitted when a job fails permanently (includes error message) */
  "job:failed": Simplify<BaseJob & { error: SerializedError }>
  /** Emitted when job progress is updated (includes current progress) */
  "job:progress": Simplify<BaseJob & { progress: number }>
  /** Emitted when a job is retried after failure */
  "job:retried": BaseJob
  /** Emitted when the queue is paused */
  "queue:paused": void
  /** Emitted when the queue is resumed */
  "queue:resumed": void
  /** Emitted when the queue is stopped */
  "queue:stopped": void
  /** Emitted when an unexpected error occurs in the queue */
  "queue:error": unknown
}

export interface PrismaAdapterProps {
  /**  model name in schema.prisma - Default: QueueJob */
  modelName?: string
  /** specifies the table name in the database - Default: queue_jobs */
  tableName?: string
  /*+ specifies the schema name in the database - Default: undefined (no schema), uses default schema ( `public` ) */
  schemaName?: string
}

export interface KyselyAdapterProps {
  /**  specifies the table name in the database - Default: queue_jobs */
  tableName?: string
  /** specifies the schema name in the database - Default: undefined (no schema), uses default schema ( `public` ) */
  schemaName?: string
}

export interface DrizzleAdapterProps {
  /** used export name in the `schema.ts` file - Default: queueJobs  */
  modelName?: string
}

export type AdapterKind = "prisma" | "drizzle" | "kysely"

export type AdapterProps<T extends AdapterKind> = T extends "prisma"
  ? PrismaAdapterProps
  : T extends "kysely"
    ? KyselyAdapterProps
    : T extends "drizzle"
      ? DrizzleAdapterProps
      : never
