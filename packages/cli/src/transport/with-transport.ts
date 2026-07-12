/**
 * Transport lifecycle management — handles connect/disconnect around command callbacks.
 */

import { resolveTransport } from "./resolve"
import type { Transport } from "./types"

export interface GlobalOptions {
  readonly url?: string
  readonly token?: string
  readonly queue?: string
}

/**
 * Manage transport lifecycle around a command callback.
 * Handles connect/disconnect and ensures cleanup on errors.
 *
 * @param options - Global CLI options for transport resolution
 * @param callback - Command logic receiving the connected transport
 * @returns The value returned by the callback
 * @throws {Error} Re-throws any error from callback after disconnect
 */
export async function withTransport<TResult>(
  options: GlobalOptions,
  callback: (transport: Transport) => Promise<TResult>
): Promise<TResult> {
  const transport = await resolveTransport(options)
  await transport.connect()
  try {
    return await callback(transport)
  } finally {
    await transport.disconnect()
  }
}
