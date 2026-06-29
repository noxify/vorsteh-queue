/**
 * Abstract base class for queue adapters.
 *
 * Provides the contract that all adapters must implement and shared utilities
 * like queue name management and ID generation.
 *
 * @example
 * ```typescript
 * class PostgresAdapter extends BaseQueueAdapter {
 *   async addJob(job: NewJob): Promise<Job> {
 *     // PostgreSQL-specific implementation
 *   }
 *   // ... implement all abstract methods
 * }
 * ```
 */

import type {
  CancelJobsFilter,
  FlowNode,
  GetNextJobOptions,
  Job,
  JobStatus,
  JobStatusUpdate,
  NewJob,
  PaginationOptions,
  QueueAdapter,
  QueueStats,
  StepState,
} from "../types"

export abstract class BaseQueueAdapter implements QueueAdapter {
  protected queueName = ""

  /**
   * Set the queue name for job isolation.
   * Called by Queue/Worker during initialization.
   *
   * @param name - Queue name for filtering jobs
   */
  setQueueName(name: string): void {
    this.queueName = name
  }

  // ─── Connection ────────────────────────────────────────────

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>

  // ─── Job CRUD ──────────────────────────────────────────────

  abstract addJob(job: NewJob): Promise<Job>
  abstract addJobs(jobs: readonly NewJob[]): Promise<readonly Job[]>
  abstract getJobById(id: string): Promise<Job | null>

  // ─── Job Picking ───────────────────────────────────────────

  abstract getNextJob(options: GetNextJobOptions): Promise<Job | null>
  abstract getNextJobsForHandler(
    handlerName: string,
    count: number,
    groupConstraints: readonly string[]
  ): Promise<readonly Job[]>

  // ─── Status Updates ────────────────────────────────────────

  abstract updateJobStatus(id: string, update: JobStatusUpdate): Promise<void>
  abstract incrementJobAttempts(id: string): Promise<void>
  abstract updateJobProgress(id: string, progress: number): Promise<void>

  // ─── Cancellation ──────────────────────────────────────────

  abstract cancelJob(id: string, reason?: string): Promise<boolean>
  abstract cancelJobs(filter: CancelJobsFilter): Promise<number>

  // ─── Dead-Letter Queue ─────────────────────────────────────

  abstract getDeadJobs(options?: PaginationOptions): Promise<readonly Job[]>
  abstract redriveJob(id: string): Promise<void>
  abstract redriveJobs(filter?: { name?: string }): Promise<number>

  // ─── Statistics & Queries ──────────────────────────────────

  abstract getQueueStats(): Promise<QueueStats>
  abstract size(): Promise<number>

  // ─── Cleanup ───────────────────────────────────────────────

  abstract clearJobs(status?: JobStatus): Promise<number>
  abstract cleanupJobs(status: JobStatus, keepCount: number): Promise<number>

  // ─── Unique Jobs ───────────────────────────────────────────

  abstract findJobByUniqueKey(uniqueKey: string): Promise<Job | null>

  // ─── Single Job Operations ─────────────────────────────────

  abstract retryJob(id: string): Promise<boolean>
  abstract runJobNow(id: string): Promise<boolean>
  abstract deleteJob(id: string): Promise<boolean>

  // ─── Transactions ──────────────────────────────────────────

  abstract transaction<TResult>(fn: () => Promise<TResult>): Promise<TResult>

  // ─── Steps ─────────────────────────────────────────────────

  abstract updateJobSteps(
    id: string,
    steps: readonly StepState[]
  ): Promise<void>
  abstract setJobSignal(
    id: string,
    event: string,
    data: unknown
  ): Promise<boolean>

  // ─── Flows ─────────────────────────────────────────────────

  abstract getFlowTree(flowId: string): Promise<FlowNode | null>
  abstract incrementChildrenCompleted(
    parentId: string
  ): Promise<{ completed: number; total: number }>
  abstract getChildrenJobs(parentId: string): Promise<readonly Job[]>

  // ─── Utilities ─────────────────────────────────────────────

  /**
   * Generate a unique job ID (UUID v4 format).
   *
   * @returns Unique string identifier
   */
  protected static generateId(): string {
    return crypto.randomUUID()
  }
}
