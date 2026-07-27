import consola from "consola"

import { buildDeleteCommandStructure } from "../metadata/delete-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

export function createDeleteCommand() {
  const command = buildDeleteCommandStructure()

  command.action(async (id, options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { queue: globalOpts.queue, token: globalOpts.token, url: globalOpts.url },
      async (transport) => {
        const success = await transport.deleteJob(id)

        if (options.json) {
          consola.log(JSON.stringify({ id, success }))
          return
        }

        if (success) {
          consola.success(`Job "${id}" deleted`)
        } else {
          consola.warn(`Could not delete job "${id}" (not found)`)
        }
      }
    )
  })

  return command
}
