/**
 * Queue resolution — determines which queue to target based on CLI flags and config.
 *
 * Resolution is purely synchronous and config-driven. No database introspection
 * or async operations are performed.
 */

import type { QueueConfigFile } from "../config"
import { CLIError } from "../errors"

export interface ResolveQueueOptions {
  /** Explicit queue name from --queue flag */
  readonly queue?: string
  /** Loaded config (may be undefined in remote mode) */
  readonly config?: QueueConfigFile
}

/**
 * Resolve the target queue name following the priority order:
 * 1. --queue flag
 * 2. defaultQueue from config
 * 3. Single queue in array
 *
 * In remote mode without a config, --queue is required.
 *
 * @param options - Queue resolution inputs
 * @returns The resolved queue name
 * @throws {CLIError} When resolution fails
 *
 * @example
 * ```typescript
 * const queueName = resolveQueueName({ queue: "email-queue", config })
 * ```
 */
export function resolveQueueName(options: ResolveQueueOptions): string {
  const { queue, config } = options

  // Priority 1: --queue flag
  if (queue) {
    // If config is available, validate the queue exists in the config
    if (config) {
      const names = config.queues.map((q) => q.name)
      if (!names.includes(queue)) {
        throw new CLIError(
          `Queue '${queue}' not found. Available queues: ${names.join(", ")}`
        )
      }
    }

    // In remote mode (no config), pass through — server will validate
    return queue
  }

  // Remote mode without --queue: config is required for implicit resolution
  if (!config) {
    throw new CLIError(
      "The --queue flag is required when no config file is available."
    )
  }

  // Priority 2: defaultQueue from config
  if (config.defaultQueue) {
    return config.defaultQueue
  }

  // Priority 3: Single queue in array
  if (config.queues.length === 1) {
    return config.queues[0]!.name
  }

  // Defensive: should not reach here due to config validation requiring defaultQueue
  // when multiple queues exist, but handle gracefully
  const names = config.queues.map((q) => q.name)
  throw new CLIError(
    `Cannot resolve queue. Multiple queues configured without a default. Available queues: ${names.join(", ")}`
  )
}
