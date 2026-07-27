/**
 * Job state machine validation.
 *
 * Enforces valid state transitions for job lifecycle management.
 * All transitions are validated against the STATE_TRANSITIONS map before execution.
 */

import { InvalidTransitionError } from "./errors"
import type { JobStatus } from "./types"
import { STATE_TRANSITIONS } from "./types"

/**
 * Validate that a state transition is allowed.
 *
 * @param currentStatus - Current job status
 * @param nextStatus - Desired next status
 * @throws {InvalidTransitionError} if transition is not allowed
 *
 * @example
 * ```typescript
 * validateTransition("pending", "processing") // ok
 * validateTransition("completed", "processing") // throws InvalidTransitionError
 * ```
 */
export function validateTransition(
  currentStatus: JobStatus,
  nextStatus: JobStatus
): void {
  const allowed = STATE_TRANSITIONS[currentStatus]
  if (!allowed.includes(nextStatus)) {
    throw new InvalidTransitionError(currentStatus, nextStatus)
  }
}

/**
 * Check if a state transition is valid without throwing.
 *
 * @param currentStatus - Current job status
 * @param nextStatus - Desired next status
 * @returns true if the transition is allowed
 *
 * @example
 * ```typescript
 * isValidTransition("pending", "processing") // true
 * isValidTransition("completed", "processing") // false
 * ```
 */
export function isValidTransition(
  currentStatus: JobStatus,
  nextStatus: JobStatus
): boolean {
  const allowed = STATE_TRANSITIONS[currentStatus]
  return allowed.includes(nextStatus)
}

/**
 * Check if a job status is terminal (no further transitions possible).
 *
 * @param status - Job status to check
 * @returns true if the status is terminal
 */
export function isTerminalStatus(status: JobStatus): boolean {
  return STATE_TRANSITIONS[status].length === 0
}
