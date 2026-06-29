/**
 * CLI configuration types.
 *
 * Supports both direct adapter connections and remote GraphQL transport.
 */

import type { QueueAdapter } from "@vorsteh-queue/core"

/** Direct transport configuration (local adapter) */
export interface DirectTransportConfig {
  readonly type: "direct"
  readonly adapter: QueueAdapter
  readonly queueName: string
}

/** GraphQL transport configuration (remote server) */
export interface GraphQLTransportConfig {
  readonly type: "graphql"
  readonly url: string
  readonly token?: string
}

/** CLI configuration */
export type CliConfig = DirectTransportConfig | GraphQLTransportConfig

/**
 * Define a CLI configuration.
 *
 * @param config - CLI configuration
 * @returns The configuration object
 *
 * @example
 * ```typescript
 * // vorsteh-queue.config.ts
 * import { defineCliConfig } from "@vorsteh-queue/cli"
 *
 * export default defineCliConfig({
 *   type: "graphql",
 *   url: "http://localhost:3000/queue/graphql",
 *   token: process.env.QUEUE_TOKEN,
 * })
 * ```
 */
export function defineCliConfig(config: CliConfig): CliConfig {
  return config
}
