/**
 * Transport resolution — determines which transport to use based on CLI options
 * and environment variables.
 */

import { loadCliConfig } from "../config"
import { CLIError } from "../errors"
import { createDirectTransport } from "./direct"
import { createGraphQLTransport } from "./graphql"
import { resolveQueueName } from "./resolve-queue"
import type { Transport } from "./types"

export interface ResolveTransportOptions {
  readonly url?: string
  readonly token?: string
  readonly queue?: string
}

/**
 * Determine which transport to use based on CLI options and environment variables.
 *
 * Resolution order:
 * 1. --url flag (highest priority)
 * 2. VORSTEH_QUEUE_URL env var
 * 3. queue.config.ts with adapter (direct mode)
 *
 * @param options - Global CLI options (url, token, queue)
 * @returns A Transport instance (not yet connected)
 * @throws {CLIError} When configuration is invalid or missing
 */
export async function resolveTransport(
  options: ResolveTransportOptions
): Promise<Transport> {
  const effectiveUrl = options.url ?? process.env.VORSTEH_QUEUE_URL ?? undefined

  if (effectiveUrl) {
    if (
      !effectiveUrl.startsWith("http://") &&
      !effectiveUrl.startsWith("https://")
    ) {
      throw new CLIError("Invalid URL: must start with http:// or https://")
    }

    const effectiveToken =
      options.token ?? process.env.VORSTEH_QUEUE_TOKEN ?? undefined

    // In remote mode, resolve queue name — requires --queue when no config available
    const queueName = resolveQueueName({ queue: options.queue })

    return createGraphQLTransport(effectiveUrl, effectiveToken, queueName)
  }

  const config = await loadCliConfig()

  const resolvedQueue = resolveQueueName({ queue: options.queue, config })

  return createDirectTransport(config.adapter, resolvedQueue)
}
