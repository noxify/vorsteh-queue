/**
 * Telemetry abstraction for vorsteh-queue.
 *
 * Provides a DI-based approach where Queue and Worker accept an optional
 * Telemetry instance. When no instance is provided, a NoopTelemetry is used
 * with zero overhead.
 *
 * For OpenTelemetry integration, use `createOtelTelemetry` from the
 * `@vorsteh-queue/core` export or pass a custom implementation.
 *
 * @example
 * ```typescript
 * import { createOtelTelemetry } from "@vorsteh-queue/core"
 *
 * const telemetry = createOtelTelemetry({ queueName: "my-queue" })
 * const queue = new Queue(adapter, { name: "my-queue", telemetry })
 * const worker = new Worker(adapter, { name: "my-queue", telemetry })
 * ```
 */

import { createRequire } from "node:module"

import type { Job } from "./types"

// ─── Span Interface ──────────────────────────────────────────────────────────

/** Minimal span interface for telemetry (decoupled from OTel Span) */
export interface TelemetrySpan {
  /** End the span */
  end: () => void
}

// ─── Telemetry Interface ─────────────────────────────────────────────────────

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
  readonly jobStarted: (job: Job) => TelemetrySpan
  /** Record a job completing successfully */
  readonly jobCompleted: (job: Job, span: TelemetrySpan) => void
  /** Record a job failing (may retry) */
  readonly jobFailed: (job: Job, error: unknown, span: TelemetrySpan) => void
  /** Record a job being retried */
  readonly jobRetried: (jobName: string) => void
  /** Record a job moving to dead letter queue */
  readonly jobDead: (jobName: string) => void
  /** Record a job being cancelled */
  readonly jobCancelled: (jobName: string) => void
  /** Execute a function within a span context (for propagation) */
  readonly withSpan: <TResult>(
    span: TelemetrySpan,
    fn: () => TResult
  ) => TResult

  // ─── Flow-level observability ────────────────────────────────

  /** Record a flow being created */
  readonly flowCreated: (flowId: string) => void
  /** Record a flow completing successfully */
  readonly flowCompleted: (flowId: string, durationMs: number) => void
  /** Record a flow failing */
  readonly flowFailed: (flowId: string) => void
  /** Record a flow node being promoted (parent job created) */
  readonly flowNodePromoted: (flowId: string, nodeId: string) => void
}

// ─── Noop Implementation ─────────────────────────────────────────────────────

const NOOP_SPAN: TelemetrySpan = {
  // oxlint-disable-next-line no-empty-function -- intentional noop
  end() {},
}

/**
 * No-op telemetry implementation. All methods are empty stubs with zero overhead.
 * Used as default when no telemetry is injected.
 */
// oxlint-disable-next-line no-empty-function -- intentional noop implementation
export const noopTelemetry: Telemetry = {
  jobAdded() {}, // oxlint-disable-line no-empty-function
  jobCancelled() {}, // oxlint-disable-line no-empty-function
  jobCompleted() {}, // oxlint-disable-line no-empty-function
  jobDead() {}, // oxlint-disable-line no-empty-function
  jobFailed() {}, // oxlint-disable-line no-empty-function
  jobRetried() {}, // oxlint-disable-line no-empty-function
  jobStarted() {
    return NOOP_SPAN
  },
  withSpan(_span, fn) {
    return fn()
  },
  flowCreated() {}, // oxlint-disable-line no-empty-function
  flowCompleted() {}, // oxlint-disable-line no-empty-function
  flowFailed() {}, // oxlint-disable-line no-empty-function
  flowNodePromoted() {}, // oxlint-disable-line no-empty-function
}

/**
 * Create a telemetry instance for a queue.
 *
 * @deprecated Use `createOtelTelemetry` for OpenTelemetry or pass a custom Telemetry to Queue/Worker.
 * This function now returns noopTelemetry.
 */
export function createTelemetry(_config: TelemetryConfig): Telemetry {
  return noopTelemetry
}

// ─── OpenTelemetry Implementation ────────────────────────────────────────────

/**
 * Create an OpenTelemetry-backed telemetry instance.
 *
 * Requires `@opentelemetry/api` to be installed as a peer dependency.
 * Throws at call time if not available.
 *
 * @param config - Telemetry configuration
 * @returns Telemetry instance backed by OpenTelemetry metrics and traces
 *
 * @example
 * ```typescript
 * import { createOtelTelemetry } from "@vorsteh-queue/core"
 *
 * const telemetry = createOtelTelemetry({ queueName: "email-queue" })
 * const worker = new Worker(adapter, { name: "email-queue", telemetry })
 * ```
 */
export function createOtelTelemetry(config: TelemetryConfig): Telemetry {
  let otel: OtelApi
  try {
    const require = createRequire(import.meta.url)
    otel = require("@opentelemetry/api") as OtelApi
  } catch {
    throw new Error(
      "createOtelTelemetry requires @opentelemetry/api to be installed. " +
        "Install it with: pnpm add @opentelemetry/api"
    )
  }

  const { metrics, trace, SpanKind, SpanStatusCode, context } = otel

  const METER_NAME = "vorsteh-queue"
  const TRACER_NAME = "vorsteh-queue"
  const METER_VERSION = "0.5.1"

  const meter = metrics.getMeter(METER_NAME, METER_VERSION)
  const tracer = trace.getTracer(TRACER_NAME, METER_VERSION)

  const jobsAdded = meter.createCounter("vorsteh_queue.jobs.added", {
    description: "Total number of jobs added to the queue",
    unit: "{job}",
  })
  const jobsProcessed = meter.createCounter("vorsteh_queue.jobs.processed", {
    description: "Total number of jobs successfully processed",
    unit: "{job}",
  })
  const jobsFailed = meter.createCounter("vorsteh_queue.jobs.failed", {
    description: "Total number of jobs that failed (includes retries)",
    unit: "{job}",
  })
  const jobsRetried = meter.createCounter("vorsteh_queue.jobs.retried", {
    description: "Total number of job retry attempts",
    unit: "{job}",
  })
  const jobsDead = meter.createCounter("vorsteh_queue.jobs.dead", {
    description: "Total number of jobs moved to dead letter queue",
    unit: "{job}",
  })
  const jobsCancelled = meter.createCounter("vorsteh_queue.jobs.cancelled", {
    description: "Total number of jobs cancelled",
    unit: "{job}",
  })
  const jobsActive = meter.createUpDownCounter("vorsteh_queue.jobs.active", {
    description: "Number of jobs currently being processed",
    unit: "{job}",
  })
  const jobDuration = meter.createHistogram("vorsteh_queue.jobs.duration", {
    description: "Duration of job processing in milliseconds",
    unit: "ms",
  })
  const jobWaitTime = meter.createHistogram("vorsteh_queue.jobs.wait_time", {
    description:
      "Time a job waited in the queue before processing, in milliseconds",
    unit: "ms",
  })

  // ─── Flow Metrics ────────────────────────────────────────────

  const flowsCreated = meter.createCounter("vorsteh_queue.flows.created", {
    description: "Total number of flows created",
    unit: "{flow}",
  })
  const flowsCompleted = meter.createCounter("vorsteh_queue.flows.completed", {
    description: "Total number of flows completed successfully",
    unit: "{flow}",
  })
  const flowsFailed = meter.createCounter("vorsteh_queue.flows.failed", {
    description: "Total number of flows that failed",
    unit: "{flow}",
  })
  const flowNodesPromoted = meter.createCounter(
    "vorsteh_queue.flows.nodes_promoted",
    {
      description: "Total number of flow nodes promoted to ready",
      unit: "{node}",
    }
  )
  const flowDuration = meter.createHistogram("vorsteh_queue.flows.duration", {
    description:
      "Duration of flow execution from creation to completion, in milliseconds",
    unit: "ms",
  })

  const queueAttr = { "vorsteh_queue.queue": config.queueName }

  return {
    jobAdded(jobName: string): void {
      jobsAdded.add(1, { ...queueAttr, "vorsteh_queue.job.name": jobName })
    },
    jobCancelled(jobName: string): void {
      jobsCancelled.add(1, { ...queueAttr, "vorsteh_queue.job.name": jobName })
    },
    jobCompleted(job: Job, span: TelemetrySpan): void {
      const attrs = {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
        "vorsteh_queue.job.id": job.id,
      }
      jobsProcessed.add(1, attrs)
      jobsActive.add(-1, { ...queueAttr, "vorsteh_queue.job.name": job.name })

      if (job.processedAt && job.completedAt) {
        const durationMs = job.completedAt.getTime() - job.processedAt.getTime()
        jobDuration.record(durationMs, attrs)
      }

      const otelSpan = span as OtelSpan
      otelSpan.setStatus({ code: SpanStatusCode.OK })
      otelSpan.end()
    },
    jobDead(jobName: string): void {
      jobsDead.add(1, { ...queueAttr, "vorsteh_queue.job.name": jobName })
    },
    jobFailed(job: Job, error: unknown, span: TelemetrySpan): void {
      const attrs = {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
        "vorsteh_queue.job.id": job.id,
      }
      jobsFailed.add(1, attrs)
      jobsActive.add(-1, { ...queueAttr, "vorsteh_queue.job.name": job.name })

      const otelSpan = span as OtelSpan
      otelSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      otelSpan.recordException(
        error instanceof Error ? error : new Error(String(error))
      )
      otelSpan.end()
    },
    jobRetried(jobName: string): void {
      jobsRetried.add(1, { ...queueAttr, "vorsteh_queue.job.name": jobName })
    },
    jobStarted(job: Job): TelemetrySpan {
      const attrs = {
        ...queueAttr,
        "vorsteh_queue.job.name": job.name,
        "vorsteh_queue.job.id": job.id,
        "vorsteh_queue.job.priority": job.priority,
        "vorsteh_queue.job.attempt": job.attempts,
      }

      const waitTimeMs = Date.now() - job.createdAt.getTime()
      jobWaitTime.record(waitTimeMs, attrs)
      jobsActive.add(1, { ...queueAttr, "vorsteh_queue.job.name": job.name })

      return tracer.startSpan(`${job.name} process`, {
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
    },
    withSpan<TResult>(span: TelemetrySpan, fn: () => TResult): TResult {
      const otelSpan = span as OtelSpan
      return context.with(trace.setSpan(context.active(), otelSpan), fn)
    },
    flowCreated(flowId: string): void {
      flowsCreated.add(1, { ...queueAttr, "vorsteh_queue.flow.id": flowId })
    },
    flowCompleted(flowId: string, durationMs: number): void {
      flowsCompleted.add(1, { ...queueAttr, "vorsteh_queue.flow.id": flowId })
      flowDuration.record(durationMs, {
        ...queueAttr,
        "vorsteh_queue.flow.id": flowId,
      })
    },
    flowFailed(flowId: string): void {
      flowsFailed.add(1, { ...queueAttr, "vorsteh_queue.flow.id": flowId })
    },
    flowNodePromoted(flowId: string, nodeId: string): void {
      flowNodesPromoted.add(1, {
        ...queueAttr,
        "vorsteh_queue.flow.id": flowId,
        "vorsteh_queue.flow.node_id": nodeId,
      })
    },
  }
}

// ─── Internal OTel Types (avoid import() annotations) ────────────────────────

/** Minimal OTel Span type for internal casts */
interface OtelSpan extends TelemetrySpan {
  setStatus: (status: { code: number; message?: string }) => void
  recordException: (exception: Error) => void
}

/** Minimal OTel API shape for dynamic require */
interface OtelApi {
  metrics: {
    getMeter: (
      name: string,
      version: string
    ) => {
      createCounter: (
        name: string,
        options: object
      ) => { add: (value: number, attrs: object) => void }
      createUpDownCounter: (
        name: string,
        options: object
      ) => { add: (value: number, attrs: object) => void }
      createHistogram: (
        name: string,
        options: object
      ) => { record: (value: number, attrs: object) => void }
    }
  }
  trace: {
    getTracer: (
      name: string,
      version: string
    ) => {
      startSpan: (name: string, options: object) => OtelSpan
    }
    setSpan: (context: unknown, span: OtelSpan) => unknown
  }
  context: {
    active: () => unknown
    with: <TResult>(context: unknown, fn: () => TResult) => TResult
  }
  SpanKind: { CONSUMER: number }
  SpanStatusCode: { OK: number; ERROR: number }
}
