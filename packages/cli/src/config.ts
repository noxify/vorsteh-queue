/**
 * CLI configuration loading.
 *
 * Uses the same `queue.config.ts` as the server for direct adapter access.
 * Also supports remote GraphQL transport for connecting to a running server.
 */

import type { QueueAdapter } from "@vorsteh-queue/core"
import { loadConfig as c12LoadConfig } from "c12"

/** Direct transport configuration (local adapter from queue.config.ts) */
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

/** Resolved CLI transport */
export type CliTransport = DirectTransportConfig | GraphQLTransportConfig

/** Raw config file shape (superset of ServerConfig) */
interface QueueConfigFile {
  readonly adapter?: QueueAdapter
  readonly queueName?: string
  readonly url?: string
  readonly token?: string
  readonly auth?: unknown
  readonly port?: number
  readonly dashboard?: boolean
}

/**
 * Load CLI transport configuration from `queue.config.ts` via c12.
 *
 * - If the config has an `adapter`, uses direct transport
 * - If the config has a `url`, uses GraphQL transport
 * - Falls back to localhost GraphQL if neither is found
 *
 * @param cwd - Directory to search for config (defaults to process.cwd())
 * @returns Resolved CLI transport configuration
 *
 * @example
 * ```typescript
 * const transport = await loadCliConfig()
 * if (transport.type === "direct") {
 *   // Use adapter directly
 * } else {
 *   // Use GraphQL client
 * }
 * ```
 */
export async function loadCliConfig(cwd?: string): Promise<CliTransport> {
  const { config } = await c12LoadConfig<QueueConfigFile>({
    name: "queue",
    cwd,
  })

  if (config?.adapter && config.queueName) {
    return {
      type: "direct",
      adapter: config.adapter,
      queueName: config.queueName,
    }
  }

  if (config?.url) {
    return {
      type: "graphql",
      url: config.url,
      token: config.token,
    }
  }

  // Default: try local server
  return {
    type: "graphql",
    url: "http://localhost:3000/graphql",
    token: undefined,
  }
}
