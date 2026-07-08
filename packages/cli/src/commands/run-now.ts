import consola from "consola"

import { buildRunNowCommandStructure } from "../metadata/run-now-metadata"
import type { Transport } from "../transport/types"

export function createRunNowCommand(transport: Transport) {
  const command = buildRunNowCommandStructure()

  command.action(async (id, options) => {
    // oxlint-disable-next-line react-doctor/async-parallel
    await transport.connect()
    const success = await transport.runJobNow(id)
    await transport.disconnect()

    if (options.json) {
      consola.log(JSON.stringify({ success, id }))
      return
    }

    if (success) {
      consola.success(`Job "${id}" promoted to pending (will run immediately)`)
    } else {
      consola.warn(
        `Could not promote job "${id}" (must be in "delayed" status)`
      )
    }
  })

  return command
}
