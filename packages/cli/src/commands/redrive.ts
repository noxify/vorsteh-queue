import consola from "consola"

import { buildRedriveCommandStructure } from "../metadata/redrive-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

export function createRedriveCommand() {
  const command = buildRedriveCommandStructure()

  command.action(async (id, options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { url: globalOpts.url, token: globalOpts.token },
      async (transport) => {
        if (options.all) {
          const count = await transport.redriveAll(
            options.name ? { name: options.name } : undefined
          )

          if (options.json) {
            consola.log(JSON.stringify({ redriven: count }))
            return
          }
          consola.success(`Redriven ${count} dead job(s)`)
          return
        }

        if (!id) {
          consola.error("Provide a job ID or use --all")
          return
        }

        await transport.redriveJob(id)

        if (options.json) {
          consola.log(JSON.stringify({ success: true, id }))
          return
        }
        consola.success(`Job "${id}" redriven to pending`)
      }
    )
  })

  return command
}
