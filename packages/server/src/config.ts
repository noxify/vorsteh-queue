/**
 * Server configuration types and helpers.
 */

import type { Queue, Worker } from "@vorsteh-queue/core"
import { loadConfig as c12LoadConfig } from "c12"
import type { MiddlewareHandler } from "hono"

/** Authentication configuration */
export type AuthConfig =
  | false
  | { tokens: readonly string[] }
  | { middleware: MiddlewareHandler }

/** Server configuration */
export interface ServerConfig {
  /** Queue instances to manage */
  readonly queues: readonly Queue[]
  /** Worker instances to observe for subscription events
   * @default []
   */
  readonly workers?: readonly Worker[]
  /** Authentication
   * @default false
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
 * import { Queue } from "@vorsteh-queue/core"
 * import { DrizzleAdapter } from "@vorsteh-queue/adapter-drizzle"
 *
 * const adapter = new DrizzleAdapter({ ... })
 * const emailQueue = new Queue(adapter, { name: "email-queue" })
 *
 * export default defineConfig({
 *   queues: [emailQueue],
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
 * @throws {Error} If no configuration file is found or validation fails
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
    cwd,
    name: "queue",
  })

  if (!config?.queues || config.queues.length === 0) {
    throw new Error(
      "No queues configured. Add at least one Queue instance to the queues array in your queue.config.ts."
    )
  }

  if (config.queues.length > 20) {
    throw new Error(
      "Too many queues configured. The queues array must contain at most 20 entries."
    )
  }

  const seen = new Set<string>()
  for (const queue of config.queues) {
    const { name } = queue
    if (seen.has(name)) {
      throw new Error(
        `Duplicate queue name '${name}'. Queue names must be unique within the configuration.`
      )
    }
    seen.add(name)
  }

  return config
}
