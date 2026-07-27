import consola from "consola"

import { buildRetryCommandStructure } from "../metadata/retry-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

export function createRetryCommand() {
  const command = buildRetryCommandStructure()

  command.action(async (id, options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { queue: globalOpts.queue, token: globalOpts.token, url: globalOpts.url },
      async (transport) => {
        const success = await transport.retryJob(id)

        if (options.json) {
          consola.log(JSON.stringify({ id, success }))
          return
        }

        if (success) {
          consola.success(`Job "${id}" retried (reset to pending)`)
        } else {
          consola.warn(
            `Could not retry job "${id}" (must be in "failed" status)`
          )
        }
      }
    )
  })

  return command
}
