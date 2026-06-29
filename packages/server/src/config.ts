/**
 * Server configuration types and helpers.
 */

import type { QueueAdapter } from "@vorsteh-queue/core"
import { loadConfig as c12LoadConfig } from "c12"
import type { MiddlewareHandler } from "hono"

/** Authentication configuration */
export type AuthConfig =
  | false
  | { tokens: readonly string[] }
  | { middleware: MiddlewareHandler }

/** Server configuration */
export interface ServerConfig {
  /** Queue adapter instance */
  readonly adapter: QueueAdapter
  /** Queue name to monitor/manage */
  readonly queueName: string
  /** Enable the web dashboard
   * @default true
   */
  readonly dashboard?: boolean
  /** Authentication configuration
   * @default false (no auth, with console warning)
   */
  readonly auth?: AuthConfig
  /** Server port (for standalone mode)
   * @default 3000
   */
  readonly port?: number
}

/**
 * Define a queue server configuration.
 *
 * @param config - Server configuration
 * @returns The configuration object (passthrough for type safety)
 *
 * @example
 * ```typescript
 * // queue.config.ts
 * import { defineConfig } from "@vorsteh-queue/server"
 * import { DrizzleAdapter } from "@vorsteh-queue/adapter-drizzle"
 *
 * export default defineConfig({
 *   adapter: new DrizzleAdapter({ ... }),
 *   queueName: "my-queue",
 *   auth: { tokens: [process.env.QUEUE_TOKEN!] },
 * })
 * ```
 */
export function defineConfig(config: ServerConfig): ServerConfig {
  return config
}

/**
 * Load configuration from a `queue.config.{ts,mts,mjs,js}` file via c12.
 *
 * Searches the current working directory and parent directories.
 *
 * @param cwd - Directory to start searching from (defaults to process.cwd())
 * @returns Resolved server configuration
 * @throws {Error} If no configuration file is found or adapter is missing
 *
 * @example
 * ```typescript
 * const config = await loadConfig()
 * const server = createQueueServer(config)
 * await server.start()
 * ```
 */
export async function loadConfig(cwd?: string): Promise<ServerConfig> {
  const { config } = await c12LoadConfig<ServerConfig>({
    name: "queue",
    cwd,
  })

  if (!config?.adapter) {
    throw new Error(
      "No adapter configured. Create a queue.config.ts file with an adapter."
    )
  }

  if (!config.queueName) {
    throw new Error(
      "No queueName configured. Add a queueName to your queue.config.ts."
    )
  }

  return config
}
