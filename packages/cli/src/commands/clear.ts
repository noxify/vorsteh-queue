import type { JobStatus } from "@vorsteh-queue/core"
import consola from "consola"

import { buildClearCommandStructure } from "../metadata/clear-metadata"
import type { Transport } from "../transport/types"

const VALID_STATUSES = [
  "pending",
  "delayed",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "dead",
]

export function createClearCommand(transport: Transport) {
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

    await transport.connect()
    const count = await transport.clearJobs(
      options.all ? undefined : (options.status as JobStatus)
    )
    await transport.disconnect()

    if (options.json) {
      consola.log(JSON.stringify({ cleared: count }))
      return
    }
    consola.success(`Cleared ${count} job(s)`)
  })

  return command
}
