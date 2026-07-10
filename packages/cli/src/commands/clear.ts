import type { JobStatus } from "@vorsteh-queue/core"
import consola from "consola"

import { buildClearCommandStructure } from "../metadata/clear-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

const VALID_STATUSES = [
  "pending",
  "delayed",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "dead",
]

export function createClearCommand() {
  const command = buildClearCommandStructure()

  command.action(async (options) => {
    if (!options.all && !options.status) {
      consola.error("Specify --status or --all")
      return
    }

    if (options.status && !VALID_STATUSES.includes(options.status)) {
      consola.error(
        `Invalid status "${options.status}". Valid: ${VALID_STATUSES.join(", ")}`
      )
      return
    }

    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { url: globalOpts.url, token: globalOpts.token },
      async (transport) => {
        const count = await transport.clearJobs(
          options.all ? undefined : (options.status as JobStatus)
        )

        if (options.json) {
          consola.log(JSON.stringify({ cleared: count }))
          return
        }
        consola.success(`Cleared ${count} job(s)`)
      }
    )
  })

  return command
}
