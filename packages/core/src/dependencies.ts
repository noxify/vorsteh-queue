/**
 * Job dependency resolution.
 *
 * Supports declaring dependencies between jobs. A job with `dependsOn` will
 * only be picked for processing once all its dependencies have completed.
 *
 * Circular dependency detection prevents infinite loops at enqueue time.
 * Failure cascade ensures dependent jobs fail when their dependencies fail.
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

      // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- dependency graph traversal must be sequential
      const job = await adapter.getJobById(id)
      if (job?.dependsOn && job.dependsOn.length > 0) {
        // oxlint-disable-next-line react-doctor/async-await-in-loop, no-await-in-loop -- recursive walk
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
 * Check if any dependency of a job has failed (dead/cancelled/failed terminally).
 *
 * @param job - Job to check dependencies for
 * @param adapter - Queue adapter to look up dependency jobs
 * @returns The failed dependency job, or null if no dependency has failed
 */
export async function getFailedDependency(
  job: Job,
  adapter: QueueAdapter
): Promise<Job | null> {
  if (!job.dependsOn || job.dependsOn.length === 0) {
    return null
  }

  for (const depId of job.dependsOn) {
    // eslint-disable-next-line no-await-in-loop
    const depJob = await adapter.getJobById(depId)
    if (depJob && (depJob.status === "dead" || depJob.status === "cancelled")) {
      return depJob
    }
  }

  return null
}

/**
 * Handle dependency failure cascade.
 * When a job moves to dead/cancelled, all jobs that depend on it are transitioned
 * based on their `onDependencyFailure` policy:
 * - `"fail"` (default): job moves to "failed" and triggers further cascade
 * - `"cancel"`: job moves to "cancelled" and does NOT trigger further cascade
 *
 * Uses iterative BFS to avoid stack overflow on deep dependency chains.
 *
 * @param failedJobId - ID of the job that failed
 * @param adapter - Queue adapter
 */
export async function cascadeDependencyFailure(
  failedJobId: string,
  adapter: QueueAdapter
): Promise<void> {
  // BFS queue of job IDs whose dependents need to be cascaded
  const pendingCascade: string[] = [failedJobId]
  const processed = new Set<string>()

  while (pendingCascade.length > 0) {
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const currentId = pendingCascade.shift()!
    if (processed.has(currentId)) {
      continue
    }
    processed.add(currentId)

    // Paginate through all jobs to find dependents
    let offset = 0
    const pageSize = 100

    // oxlint-disable-next-line no-constant-condition -- paginated loop terminates via break
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const page = await adapter.getJobs({ limit: pageSize, offset })
      if (page.length === 0) {
        break
      }

      for (const job of page) {
        if (!job.dependsOn?.includes(currentId)) {
          continue
        }
        // Only cascade to jobs that are still active (pending/delayed)
        if (job.status !== "pending" && job.status !== "delayed") {
          continue
        }

        const policy = job.onDependencyFailure ?? "fail"

        if (policy === "cancel") {
          // eslint-disable-next-line no-await-in-loop
          await adapter.updateJobStatus(job.id, {
            cancellationReason: `Dependency job ${currentId} failed`,
            status: "cancelled",
          })
          // "cancel" does NOT trigger further cascade
        } else {
          // eslint-disable-next-line no-await-in-loop
          await adapter.updateJobStatus(job.id, {
            error: {
              message: `Dependency job ${currentId} failed`,
              name: "DependencyFailedError",
            },
            status: "failed",
          })
          // "fail" triggers further cascade to this job's dependents
          pendingCascade.push(job.id)
        }
      }

      offset += pageSize
      if (page.length < pageSize) {
        break
      }
    }
  }
}
