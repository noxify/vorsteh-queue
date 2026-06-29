/**
 * Job dependency resolution.
 *
 * Supports declaring dependencies between jobs. A job with `dependsOn` will
 * only be picked for processing once all its dependencies have completed.
 *
 * Circular dependency detection prevents infinite loops at enqueue time.
 */

import type { Job, QueueAdapter } from "./types"

/**
 * Error thrown when a circular dependency is detected.
 */
/* eslint-disable @typescript-eslint/parameter-properties */
// eslint-disable-next-line max-classes-per-file
export class CircularDependencyError extends Error {
  override readonly name = "CircularDependencyError"

  constructor(readonly cycle: readonly string[]) {
    super(`Circular dependency detected: ${cycle.join(" → ")}`)
  }
}

/**
 * Detect circular dependencies before adding a job.
 *
 * @param jobId - ID of the new job being added
 * @param dependsOn - IDs the new job depends on
 * @param adapter - Queue adapter to look up existing jobs
 * @throws {CircularDependencyError} If a cycle is detected
 */
export async function detectCircularDependencies(
  jobId: string,
  dependsOn: readonly string[],
  adapter: QueueAdapter
): Promise<void> {
  const visited = new Set<string>()
  const path: string[] = [jobId]

  async function walk(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      if (id === jobId) {
        throw new CircularDependencyError([...path, id])
      }
      if (visited.has(id)) {
        continue
      }
      visited.add(id)
      path.push(id)

      // eslint-disable-next-line no-await-in-loop
      const job = await adapter.getJobById(id)
      if (job?.dependsOn && job.dependsOn.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await walk(job.dependsOn)
      }

      path.pop()
    }
  }

  await walk(dependsOn)
}

/**
 * Check if all dependencies of a job are satisfied (completed).
 *
 * @param job - Job to check dependencies for
 * @param adapter - Queue adapter to look up dependency jobs
 * @returns true if all dependencies are completed (or job has no dependencies)
 */
export async function areDependenciesMet(
  job: Job,
  adapter: QueueAdapter
): Promise<boolean> {
  if (!job.dependsOn || job.dependsOn.length === 0) {
    return true
  }

  for (const depId of job.dependsOn) {
    // eslint-disable-next-line no-await-in-loop
    const depJob = await adapter.getJobById(depId)
    if (!depJob || depJob.status !== "completed") {
      return false
    }
  }

  return true
}

/**
 * Handle dependency failure cascade.
 * When a dependency fails/cancels, dependent jobs should be affected based on `onDependencyFailure`.
 *
 * @param failedJobId - ID of the job that failed
 * @param adapter - Queue adapter
 * @param action - What to do with dependents ("cancel" | "fail" | "ignore")
 */
export async function cascadeDependencyFailure(
  failedJobId: string,
  adapter: QueueAdapter,
  action: "cancel" | "fail" | "ignore"
): Promise<void> {
  if (action === "ignore") {
    return
  }

  // For now, we don't have an efficient way to find all jobs that depend on this one
  // without a reverse-dependency index. This will be implemented with a query at the adapter level.
  // For the memory adapter and simple cases, this is acceptable.
  // eslint-disable-next-line no-warning-comments
  // TODO: Add findDependentJobs(jobId) to adapter interface for efficient cascade
  void failedJobId
  void adapter
}
