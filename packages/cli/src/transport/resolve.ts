/**
 * Transport resolution — determines which transport to use based on CLI options
 * and environment variables.
 */

import type { QueueAdapter } from "@vorsteh-queue/core"
import { loadConfig } from "c12"

import { CLIError } from "../errors"
import { createDirectTransport } from "./direct"
import { createGraphQLTransport } from "./graphql"
import type { Transport } from "./types"

export interface ResolveTransportOptions {
  readonly url?: string
  readonly token?: string
}

interface QueueConfigFile {
  readonly adapter?: QueueAdapter
  readonly queueName?: string
}

/**
 * Determine which transport to use based on CLI options and environment variables.
 *
 * Resolution order:
 * 1. --url flag (highest priority)
 * 2. VORSTEH_QUEUE_URL env var
 * 3. queue.config.ts with adapter (direct mode)
 *
 * @param options - Global CLI options (url, token)
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
    return createGraphQLTransport(effectiveUrl, effectiveToken)
  }

  const { config } = await loadConfig<QueueConfigFile>({ name: "queue" })

  if (!config?.adapter) {
    throw new CLIError(
      "No adapter configured. Create a queue.config.ts with an adapter, or provide --url for remote mode."
    )
  }

  if (!config.queueName) {
    throw new CLIError("Missing queueName in queue.config.ts.")
  }

  return createDirectTransport(config.adapter, config.queueName)
}
