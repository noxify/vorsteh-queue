// oxlint-disable react-doctor/async-parallel
import consola from "consola"

import { buildStatusCommandStructure } from "../metadata/status-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

export function createStatusCommand() {
  const command = buildStatusCommandStructure()

  command.action(async (options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { queue: globalOpts.queue, token: globalOpts.token, url: globalOpts.url },
      async (transport) => {
        const stats = await transport.getStats()
        // oxlint-disable-next-line react-doctor/server-sequential-independent-await
        const size = await transport.size()

        if (options.json) {
          consola.log(JSON.stringify({ ...stats, size }, null, 2))
          return
        }

        consola.info("Queue Status:")
        consola.log(`  Pending:    ${stats.pending}`)
        consola.log(`  Delayed:    ${stats.delayed}`)
        consola.log(`  Processing: ${stats.processing}`)
        consola.log(`  Completed:  ${stats.completed}`)
        consola.log(`  Failed:     ${stats.failed}`)
        consola.log(`  Cancelled:  ${stats.cancelled}`)
        consola.log(`  Dead:       ${stats.dead}`)
        consola.log(`  Size:       ${size}`)
      }
    )
  })

  return command
}
