/**
 * CLI configuration loading and validation.
 *
 * Loads multi-queue configuration from `queue.config.ts` via c12.
 * Validates the config shape and throws CLIError for invalid configurations.
 */

import type { Queue, QueueAdapter } from "@vorsteh-queue/core"
import { loadConfig as c12LoadConfig } from "c12"

import { CLIError } from "./errors"

/**
 * Multi-queue config file shape.
 *
 * Users export this from `queue.config.ts` to configure the CLI
 * with one or more Queue instances sharing a single adapter.
 *
 * @example
 * ```typescript
 * import { Queue } from "@vorsteh-queue/core"
 * import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
 *
 * const adapter = new PostgresQueueAdapter(db)
 * const emailQueue = new Queue(adapter, { name: "email-queue" })
 * const reportQueue = new Queue(adapter, { name: "report-queue" })
 *
 * export default {
 *   adapter,
 *   queues: [emailQueue, reportQueue],
 *   defaultQueue: "email-queue",
 * }
 * ```
 */
export interface QueueConfigFile {
  /** Shared adapter instance */
  readonly adapter: QueueAdapter
  /** Array of Queue instances (1+) */
  readonly queues: readonly Queue[]
  /** Default queue name (required when queues.length > 1) */
  readonly defaultQueue?: string
}

/**
 * Validate the loaded config file and return a typed QueueConfigFile.
 *
 * @param config - Raw config object from c12
 * @throws {CLIError} When validation fails
 */
function validateConfig(config: Partial<QueueConfigFile>): QueueConfigFile {
  if (!config.adapter) {
    throw new CLIError(
      "No adapter configured. Create a queue.config.ts with an adapter, or provide --url for remote mode."
    )
  }

  if (!config.queues || config.queues.length === 0) {
    throw new CLIError(
      "Configuration error: at least one Queue instance must be provided in the queues array."
    )
  }

  const names = config.queues.map((q) => q.name)

  const seen = new Set<string>()
  for (const name of names) {
    if (seen.has(name)) {
      throw new CLIError(
        `Configuration error: duplicate queue name '${name}'. Queue names must be unique.`
      )
    }
    seen.add(name)
  }

  if (config.queues.length > 1 && !config.defaultQueue) {
    throw new CLIError(
      `Configuration error: defaultQueue is required when multiple queues are configured. Available: ${names.join(", ")}`
    )
  }

  if (config.defaultQueue && !names.includes(config.defaultQueue)) {
    throw new CLIError(
      `Configuration error: defaultQueue '${config.defaultQueue}' does not match any configured queue. Available: ${names.join(", ")}`
    )
  }

  return {
    adapter: config.adapter,
    queues: config.queues,
    defaultQueue: config.defaultQueue,
  }
}

/**
 * Load and validate CLI configuration from `queue.config.ts` via c12.
 *
 * @param cwd - Directory to search for config (defaults to process.cwd())
 * @returns Validated multi-queue configuration
 * @throws {CLIError} When configuration is missing or invalid
 *
 * @example
 * ```typescript
 * const config = await loadCliConfig()
 * console.log(config.queues.map(q => q.name))
 * ```
 */
export async function loadCliConfig(cwd?: string): Promise<QueueConfigFile> {
  const { config } = await c12LoadConfig<Partial<QueueConfigFile>>({
    name: "queue",
    cwd,
  })

  if (!config) {
    throw new CLIError(
      "No adapter configured. Create a queue.config.ts with an adapter, or provide --url for remote mode."
    )
  }

  return validateConfig(config)
}
