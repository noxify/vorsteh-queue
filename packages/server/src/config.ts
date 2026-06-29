/**
 * Server configuration types and helpers.
 */

import type { QueueAdapter } from "@vorsteh-queue/core"
import type { MiddlewareHandler } from "hono"

/** Authentication configuration */
export type AuthConfig =
  | false
  | { type: "token"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "custom"; middleware: MiddlewareHandler }

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
 * Define a queue server configuration (for use with c12 config files).
 *
 * @param config - Server configuration
 * @returns The configuration object
 *
 * @example
 * ```typescript
 * // vorsteh-queue.config.ts
 * import { defineConfig } from "@vorsteh-queue/server"
 *
 * export default defineConfig({
 *   adapter: myAdapter,
 *   queueName: "my-queue",
 *   auth: { type: "token", token: process.env.QUEUE_TOKEN },
 * })
 * ```
 */
export function defineConfig(config: ServerConfig): ServerConfig {
  return config
}
