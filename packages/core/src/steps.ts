/**
 * Job Steps implementation with Saga compensation and signals.
 *
 * Steps provide durable, resumable multi-step job execution.
 * Each step is idempotent — if a job is retried, completed steps are replayed
 * from cached results without re-executing.
 *
 * @example
 * ```typescript
 * worker.register("onboarding", async (job, { step }) => {
 *   const user = await step.run("create-user", () => createUser(job.payload), {
 *     compensate: (result) => deleteUser(result.id),
 *   })
 *   await step.run("send-welcome", () => sendEmail(user.email))
 *   await step.sleep("wait-1h", "1h")
 *   const approval = await step.waitFor("approval", "manager-approved", { timeout: "24h" })
 *   await step.run("finalize", () => finalize(user, approval))
 *   return { userId: user.id }
 * })
 * ```
 */

import type {
  Job,
  QueueAdapter,
  StepContext,
  StepRunOptions,
  StepState,
  WaitForOptions,
} from "./types"
import { serializeError } from "./utils/error"

/* eslint-disable max-classes-per-file */
/* eslint-disable unicorn/custom-error-definition */
/* eslint-disable @typescript-eslint/parameter-properties */

/**
 * Thrown internally to interrupt job execution when a sleep step is encountered.
 * The Worker catches this and re-queues the job as delayed.
 */
export class SleepInterrupt extends Error {
  override readonly name = "SleepInterrupt"

  constructor(
    readonly stepName: string,
    readonly duration: number
  ) {
    super(`Sleep step "${stepName}" pausing for ${duration}ms`)
  }
}

/**
 * Thrown internally to interrupt job execution when a waitFor step is encountered.
 * The Worker catches this and moves the job to delayed (waiting for signal).
 */
export class WaitForInterrupt extends Error {
  override readonly name = "WaitForInterrupt"

  constructor(
    readonly stepName: string,
    readonly event: string,
    readonly timeout?: number
  ) {
    super(`WaitFor step "${stepName}" waiting for signal "${event}"`)
  }
}

interface CompensationEntry {
  readonly name: string
  readonly result: unknown
  readonly compensate: (result: unknown) => Promise<void>
}

/**
 * Create a StepContext for a job execution.
 *
 * @param jobId - ID of the current job
 * @param job - The full job record (for accessing signals)
 * @param adapter - Queue adapter for persisting step state
 * @returns StepContext implementation and helpers
 */
export function createStepContext(
  jobId: string,
  job: Job,
  adapter: QueueAdapter
): {
  context: StepContext
  getSteps: () => readonly StepState[]
  runCompensations: () => Promise<void>
} {
  const steps: StepState[] = [...(job.steps ?? [])]
  const compensations: CompensationEntry[] = []

  const context: StepContext = {
    async all<TResults extends readonly unknown[]>(promises: {
      [K in keyof TResults]: Promise<TResults[K]>
    }): Promise<TResults> {
      return Promise.all(promises) as Promise<TResults>
    },

    async run<TResult>(
      name: string,
      fn: () => Promise<TResult>,
      options?: StepRunOptions<TResult>
    ): Promise<TResult> {
      // Check if step already completed (replay from cache)
      const existing = steps.find((s) => s.name === name)
      if (existing?.status === "completed") {
        // Re-register compensation for replay (needed for saga rollback)
        if (options?.compensate) {
          compensations.push({
            name,
            result: existing.result,
            compensate: options.compensate as (
              result: unknown
            ) => Promise<void>,
          })
        }
        return existing.result as TResult
      }

      // Mark step as running
      const runningStep: StepState = {
        name,
        status: "running",
        startedAt: new Date(),
      }
      updateOrAddStep(steps, runningStep)
      await persistSteps(jobId, steps, adapter)

      try {
        const result = await fn()

        // Mark step as completed
        const completedStep: StepState = {
          name,
          status: "completed",
          result,
          startedAt: runningStep.startedAt,
          completedAt: new Date(),
        }
        updateOrAddStep(steps, completedStep)
        await persistSteps(jobId, steps, adapter)

        // Register compensation
        if (options?.compensate) {
          compensations.push({
            name,
            result,
            compensate: options.compensate as (
              result: unknown
            ) => Promise<void>,
          })
        }

        return result
      } catch (error) {
        // Mark step as failed
        const failedStep: StepState = {
          name,
          status: "failed",
          error: serializeError(error),
          startedAt: runningStep.startedAt,
        }
        updateOrAddStep(steps, failedStep)
        await persistSteps(jobId, steps, adapter)

        throw error
      }
    },

    async sleep(name: string, duration: string | number): Promise<void> {
      // Check if sleep already completed (replay)
      const existing = steps.find((s) => s.name === name)
      if (existing?.status === "completed") {
        return
      }

      const durationMs = parseDuration(duration)

      // Mark sleep step as completed (will resume after delay)
      const sleepStep: StepState = {
        name,
        status: "completed",
        startedAt: new Date(),
        completedAt: new Date(),
      }
      updateOrAddStep(steps, sleepStep)
      await persistSteps(jobId, steps, adapter)

      throw new SleepInterrupt(name, durationMs)
    },

    async waitFor<TData = unknown>(
      name: string,
      event: string,
      options?: WaitForOptions
    ): Promise<TData> {
      // Check if signal already received (replay)
      const signals = job.signals ?? {}
      if (event in signals) {
        // Mark step as completed if not already
        const existing = steps.find((s) => s.name === name)
        if (existing?.status !== "completed") {
          const completedStep: StepState = {
            name,
            status: "completed",
            result: signals[event],
            startedAt: new Date(),
            completedAt: new Date(),
          }
          updateOrAddStep(steps, completedStep)
          await persistSteps(jobId, steps, adapter)
        }
        return signals[event] as TData
      }

      // Mark step as waiting
      const waitingStep: StepState = {
        name,
        status: "waiting",
        waitingFor: event,
        startedAt: new Date(),
      }
      updateOrAddStep(steps, waitingStep)
      await persistSteps(jobId, steps, adapter)

      const timeout = options?.timeout
        ? parseDuration(options.timeout)
        : undefined
      throw new WaitForInterrupt(name, event, timeout)
    },
  }

  return {
    context,
    getSteps: () => steps,
    async runCompensations() {
      // Run compensations in reverse order (saga pattern)
      for (let i = compensations.length - 1; i >= 0; i -= 1) {
        const entry = compensations[i]
        if (!entry) {
          continue
        }
        try {
          // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- compensations must run in reverse order
          await entry.compensate(entry.result)
        } catch (compensationError) {
          // Log but don't throw — other compensations should still run
          // eslint-disable-next-line no-console
          console.error(
            `Compensation for step "${entry.name}" failed:`,
            compensationError
          )
        }
      }
    },
  }
}

/**
 * Calculate automatic progress from completed steps.
 *
 * @param steps - Current step states
 * @returns Progress percentage (0-100)
 */
export function calculateStepProgress(steps: readonly StepState[]): number {
  if (steps.length === 0) {
    return 0
  }
  const completed = steps.filter((s) => s.status === "completed").length
  return Math.round((completed / steps.length) * 100)
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

function updateOrAddStep(steps: StepState[], step: StepState): void {
  const index = steps.findIndex((s) => s.name === step.name)
  if (index === -1) {
    steps.push(step)
  } else {
    steps[index] = step
  }
}

async function persistSteps(
  jobId: string,
  steps: readonly StepState[],
  adapter: QueueAdapter
): Promise<void> {
  await adapter.updateJobSteps(jobId, steps)
}

export function parseDuration(duration: string | number): number {
  if (typeof duration === "number") {
    return duration
  }

  const match = /^(?<val>\d+)(?<unit>ms|s|m|h|d)$/u.exec(duration)
  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". Use number (ms) or string like "1h", "30m", "5s"`
    )
  }

  const value = Number(match.groups?.val)
  const { unit } = match.groups ?? {}

  switch (unit) {
    case "ms": {
      return value
    }
    case "s": {
      return value * 1000
    }
    case "m": {
      return value * 60_000
    }
    case "h": {
      return value * 3_600_000
    }
    case "d": {
      return value * 86_400_000
    }
    default: {
      return value
    }
  }
}
