import consola from "consola"

import { buildRunNowCommandStructure } from "../metadata/run-now-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

export function createRunNowCommand() {
  const command = buildRunNowCommandStructure()

  command.action(async (id, options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { queue: globalOpts.queue, token: globalOpts.token, url: globalOpts.url },
      async (transport) => {
        const success = await transport.runJobNow(id)

        if (options.json) {
          consola.log(JSON.stringify({ id, success }))
          return
        }

        if (success) {
          consola.success(
            `Job "${id}" promoted to pending (will run immediately)`
          )
        } else {
          consola.warn(
            `Could not promote job "${id}" (must be in "delayed" status)`
          )
        }
      }
    )
  })

  return command
}
