/**
 * Custom error classes for vorsteh-queue.
 *
 * Each error class represents a specific failure mode in the queue system.
 */

/* eslint-disable max-classes-per-file */

import type { Job, JobStatus } from "./types"

/**
 * Thrown when a job exceeds its timeout duration.
 *
 * @example
 * ```typescript
 * throw new TimeoutError("Job abc123 did not complete within 30000ms")
 * ```
 */
export class TimeoutError extends Error {
  override readonly name = "TimeoutError"
}

/**
 * Thrown when attempting to add a job with a unique key that already exists.
 *
 * @example
 * ```typescript
 * throw new DuplicateJobError("send-welcome-email:user-123", "existing-job-id")
 * ```
 */
export class DuplicateJobError extends Error {
  override readonly name = "DuplicateJobError"
  readonly uniqueKey: string
  readonly existingJobId: string

  constructor(uniqueKey: string, existingJobId: string) {
    super(
      `Job with unique key "${uniqueKey}" already exists (job: ${existingJobId})`
    )
    this.uniqueKey = uniqueKey
    this.existingJobId = existingJobId
  }
}

/**
 * Thrown when a job fails and the caller is waiting for its result.
 *
 * @example
 * ```typescript
 * throw new JobFailedError(failedJob)
 * ```
 */
export class JobFailedError extends Error {
  override readonly name = "JobFailedError"
  readonly job: Job

  constructor(job: Job) {
    super(`Job ${job.id} failed: ${job.error?.message ?? "unknown error"}`)
    this.job = job
  }
}

/**
 * Thrown when a job is cancelled and the caller is waiting for its result.
 *
 * @example
 * ```typescript
 * throw new JobCancelledError(cancelledJob)
 * ```
 */
export class JobCancelledError extends Error {
  override readonly name = "JobCancelledError"
  readonly job: Job

  constructor(job: Job) {
    super(
      `Job ${job.id} was cancelled${job.cancellationReason ? `: ${job.cancellationReason}` : ""}`
    )
    this.job = job
  }
}

/**
 * Thrown when a job moves to the dead-letter queue and the caller is waiting for its result.
 *
 * @example
 * ```typescript
 * throw new JobDeadError(deadJob)
 * ```
 */
export class JobDeadError extends Error {
  override readonly name = "JobDeadError"
  readonly job: Job

  constructor(job: Job) {
    super(
      `Job ${job.id} moved to dead-letter queue after ${job.attempts} attempts`
    )
    this.job = job
  }
}

/**
 * Thrown when an invalid state transition is attempted.
 *
 * @example
 * ```typescript
 * throw new InvalidTransitionError("completed", "processing")
 * ```
 */
export class InvalidTransitionError extends Error {
  override readonly name = "InvalidTransitionError"
  readonly from: JobStatus
  readonly to: JobStatus

  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid state transition: ${from} → ${to}`)
    this.from = from
    this.to = to
  }
}
