/**
 * OpenTelemetry instrumentation for vorsteh-queue.
 *
 * Provides automatic metrics collection and distributed tracing for queue
 * operations. When no OpenTelemetry SDK is configured, all instrumentation
 * is a no-op with zero overhead.
 *
 * @example
 * ```typescript
 * import { createTelemetry } from "@vorsteh-queue/core"
 *
 * // Telemetry is created automatically by Queue/Worker, but you can
 * // also create a standalone instance for custom instrumentation:
 * const telemetry = createTelemetry({ queueName: "my-queue" })
 * ```
 */

import { metrics, trace } from "@opentelemetry/api"
import type {
  Counter,
  Histogram,
  Meter,
  Span,
  Tracer,
  UpDownCounter,
} from "@opentelemetry/api"
import { SpanKind, SpanStatusCode } from "@opentelemetry/api"

import type { Job } from "./types"

// ─── Constants ───────────────────────────────────────────────────────────────

const METER_NAME = "vorsteh-queue"
const TRACER_NAME = "vorsteh-queue"
const METER_VERSION = "0.5.1"

// ─── Metric Names (following OTel Semantic Conventions for messaging) ────────

const METRIC_JOBS_ADDED = "vorsteh_queue.jobs.added"
const METRIC_JOBS_PROCESSED = "vorsteh_queue.jobs.processed"
const METRIC_JOBS_FAILED = "vorsteh_queue.jobs.failed"
const METRIC_JOBS_RETRIED = "vorsteh_queue.jobs.retried"
const METRIC_JOBS_DEAD = "vorsteh_queue.jobs.dead"
const METRIC_JOBS_CANCELLED = "vorsteh_queue.jobs.cancelled"
const METRIC_JOBS_ACTIVE = "vorsteh_queue.jobs.active"
const METRIC_JOBS_DURATION = "vorsteh_queue.jobs.duration"
const METRIC_JOBS_WAIT_TIME = "vorsteh_queue.jobs.wait_time"

// ─── Types ───────────────────────────────────────────────────────────────────

/** Configuration for creating a telemetry instance */
export interface TelemetryConfig {
  /** Queue name used as attribute on all metrics and spans */
  readonly queueName: string
}

/** Telemetry instance providing metrics and tracing for queue operations */
export interface Telemetry {
  /** Record a job being added to the queue */
  readonly jobAdded: (jobName: string) => void
  /** Record a job starting processing (increments active gauge, returns span) */
  readonly jobStarted: (job: Job) => Span
  /** Record a job completing successfully */
  readonly jobCompleted: (job: Job, span: Span) => void
  /** Record a job failing (may retry) */
  readonly jobFailed: (job: Job, error: unknown, span: Span) => void
  /** Record a job being retried */
  readonly jobRetried: (jobName: string) => void
  /** Record a job moving to dead letter queue */
  readonly jobDead: (jobName: string) => void
  /** Record a job being cancelled */
  readonly jobCancelled: (jobName: string) => void
  /** The underlying OTel tracer */
  readonly tracer: Tracer
  /** The underlying OTel meter */
  readonly meter: Meter
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a telemetry instance for a queue.
 *
 * Uses the global OpenTelemetry API — if no SDK is registered, all
 * operations are no-ops with negligible overhead.
 *
 * @param config - Telemetry configuration
 * @returns Telemetry instance with metrics and tracing methods
 *
 * @example
 * ```typescript
 * const telemetry = createTelemetry({ queueName: "email-queue" })
 * telemetry.jobAdded("send-welcome")
 * ```
 */
export function createTelemetry(config: TelemetryConfig): Telemetry {
  const meter = metrics.getMeter(METER_NAME, METER_VERSION)
  const tracer = trace.getTracer(TRACER_NAME, METER_VERSION)

  const jobsAdded = meter.createCounter(METRIC_JOBS_ADDED, {
    description: "Total number of jobs added to the queue",
    unit: "{job}",
  })

  const jobsProcessed = meter.createCounter(METRIC_JOBS_PROCESSED, {
    description: "Total number of jobs successfully processed",
    unit: "{job}",
  })

  const jobsFailed = meter.createCounter(METRIC_JOBS_FAILED, {
    description: "Total number of jobs that failed (includes retries)",
    unit: "{job}",
  })

  const jobsRetried = meter.createCounter(METRIC_JOBS_RETRIED, {
    description: "Total number of job retry attempts",
    unit: "{job}",
  })

  const jobsDead = meter.createCounter(METRIC_JOBS_DEAD, {
    description: "Total number of jobs moved to dead letter queue",
    unit: "{job}",
  })

  const jobsCancelled = meter.createCounter(METRIC_JOBS_CANCELLED, {
    description: "Total number of jobs cancelled",
    unit: "{job}",
  })

  const jobsActive = meter.createUpDownCounter(METRIC_JOBS_ACTIVE, {
    description: "Number of jobs currently being processed",
    unit: "{job}",
  })

  const jobDuration = meter.createHistogram(METRIC_JOBS_DURATION, {
    description: "Duration of job processing in milliseconds",
    unit: "ms",
  })

  const jobWaitTime = meter.createHistogram(METRIC_JOBS_WAIT_TIME, {
    description:
      "Time a job waited in the queue before processing, in milliseconds",
    unit: "ms",
  })

  const queueAttr = { "vorsteh_queue.queue": config.queueName }

  return {
    jobAdded(jobName: string): void {
      jobsAdded.add(1, {
        ...queueAttr,
        "vorsteh_queue.job.name": jobName,
      })
    },
    jobCancelled(jobName: string): void {
      jobsCancelled.add(1, {
        ...queueAttr,
        "vorsteh_queue.job.name": jobName,
      })
    },
    jobCompleted(job: Job, span: Span): void {
      const attrs = {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
        "vorsteh_queue.job.id": job.id,
      }

      jobsProcessed.add(1, attrs)
      jobsActive.add(-1, {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
      })

      // Record duration from processedAt if available, otherwise span timing handles it
      if (job.processedAt && job.completedAt) {
        const durationMs = job.completedAt.getTime() - job.processedAt.getTime()
        jobDuration.record(durationMs, attrs)
      }

      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    },
    jobDead(jobName: string): void {
      jobsDead.add(1, {
        ...queueAttr,
        "vorsteh_queue.job.name": jobName,
      })
    },
    jobFailed(job: Job, error: unknown, span: Span): void {
      const attrs = {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
        "vorsteh_queue.job.id": job.id,
      }

      jobsFailed.add(1, attrs)
      jobsActive.add(-1, {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
      })

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      span.recordException(
        error instanceof Error ? error : new Error(String(error))
      )
      span.end()
    },
    jobRetried(jobName: string): void {
      jobsRetried.add(1, {
        ...queueAttr,
        "vorsteh_queue.job.name": jobName,
      })
    },
    jobStarted(job: Job): Span {
      const attrs = {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
        "vorsteh_queue.job.id": job.id,
        "vorsteh_queue.job.priority": job.priority,
        "vorsteh_queue.job.attempt": job.attempts,
      }

      // Record wait time (time from creation to processing start)
      const waitTimeMs = Date.now() - job.createdAt.getTime()
      jobWaitTime.record(waitTimeMs, attrs)

      // Increment active gauge
      jobsActive.add(1, {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
      })

      // Start a span for this job execution
      const span = tracer.startSpan(`${job.name} process`, {
        kind: SpanKind.CONSUMER,
        attributes: {
          "messaging.system": "vorsteh-queue",
          "messaging.operation": "process",
          "messaging.destination.name": config.queueName,
          "vorsteh_queue.job.id": job.id,
          "vorsteh_queue.job.name": job.name,
          "vorsteh_queue.job.priority": job.priority,
          "vorsteh_queue.job.attempt": job.attempts,
          "vorsteh_queue.job.max_attempts": job.maxAttempts,
        },
      })

      return span
    },
    meter,
    tracer,
  }
}
