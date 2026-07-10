import consola from "consola"

import { buildCancelCommandStructure } from "../metadata/cancel-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

export function createCancelCommand() {
  const command = buildCancelCommandStructure()

  command.action(async (id, options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { url: globalOpts.url, token: globalOpts.token },
      async (transport) => {
        const success = await transport.cancelJob(id, options.reason)

        if (options.json) {
          consola.log(JSON.stringify({ success, id }))
          return
        }

        if (success) {
          consola.success(`Job "${id}" cancelled`)
        } else {
          consola.warn(
            `Could not cancel job "${id}" (may already be in terminal state)`
          )
        }
      }
    )
  })

  return command
}
