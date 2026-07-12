/**
 * Retry delay calculation strategies.
 *
 * Supports exponential backoff (with jitter), linear backoff, fixed delays,
 * and custom functions for maximum flexibility.
 */

import type { RetryStrategyConfig } from "./types"

/**
 * Calculate the delay before retrying a failed job.
 *
 * @param strategy - Retry strategy configuration or custom function
 * @param attempts - Number of attempts completed so far (0-indexed for first retry)
 * @returns Delay in milliseconds before the next retry
 *
 * @example
 * ```typescript
 * // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
 * const delay = calculateRetryDelay(
 *   { type: "exponential", delay: 1000, maxDelay: 30000 },
 *   2,
 * )
 *
 * // Custom function
 * const delay = calculateRetryDelay((attempts) => attempts * 5000, 3)
 * ```
 */
export function calculateRetryDelay(
  strategy: RetryStrategyConfig,
  attempts: number
): number {
  if (typeof strategy === "function") {
    return strategy(attempts)
  }

  switch (strategy.type) {
    case "exponential": {
      return Math.min(
        strategy.delay * 2 ** attempts + Math.random() * 100,
        strategy.maxDelay
      )
    }
    case "linear": {
      return Math.min(strategy.delay * (attempts + 1), strategy.maxDelay)
    }
    case "fixed": {
      return strategy.delay
    }
    default: {
      return strategy.delay
    }
  }
}

/** Default retry strategy used when none is specified */
export const DEFAULT_RETRY_STRATEGY: RetryStrategyConfig = {
  delay: 1000,
  maxDelay: 30_000,
  type: "exponential",
}
