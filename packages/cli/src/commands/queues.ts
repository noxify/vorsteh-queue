/**
 * Queues command — lists all available queues from the config file.
 *
 * This command does NOT use a transport connection. It reads queue names
 * directly from the loaded CLI config.
 */
import consola from "consola"

import { loadCliConfig } from "../config"
import { buildQueuesCommandStructure } from "../metadata/queues-metadata"

interface QueueListEntry {
  readonly name: string
  readonly isDefault: boolean
}

/**
 * Create the `queues` command that lists all available queues from config.
 *
 * @returns A Commander Command instance
 */
export function createQueuesCommand() {
  const command = buildQueuesCommandStructure()

  command.action(async (options) => {
    const config = await loadCliConfig()

    const defaultQueue = resolveDefaultQueueName(config)
    const entries: QueueListEntry[] = config.queues.map((q) => ({
      isDefault: q.name === defaultQueue,
      name: q.name,
    }))

    if (options.json) {
      consola.log(JSON.stringify(entries, null, 2))
      return
    }

    consola.info("Available queues:")
    for (const entry of entries) {
      const suffix = entry.isDefault ? " (default)" : ""
      consola.log(`  ${entry.name}${suffix}`)
    }
  })

  return command
}

/**
 * Determine the default queue name from the config.
 *
 * @param config - The loaded CLI config
 * @returns The default queue name, or undefined if none can be resolved
 */
function resolveDefaultQueueName(config: {
  readonly queues: readonly { readonly name: string }[]
  readonly defaultQueue?: string
}): string | undefined {
  if (config.defaultQueue) {
    return config.defaultQueue
  }

  if (config.queues.length === 1) {
    return config.queues[0]!.name
  }

  return undefined
}
