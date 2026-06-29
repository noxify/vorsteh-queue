import consola from "consola"

import { buildDeleteCommandStructure } from "../metadata/delete-metadata"
import type { Transport } from "../transport/types"

export function createDeleteCommand(transport: Transport) {
  const command = buildDeleteCommandStructure()

  command.action(async (id, options) => {
    await transport.connect()
    const success = await transport.deleteJob(id)
    await transport.disconnect()

    if (options.json) {
      consola.log(JSON.stringify({ success, id }))
      return
    }

    if (success) {
      consola.success(`Job "${id}" deleted`)
    } else {
      consola.warn(`Could not delete job "${id}" (not found)`)
    }
  })

  return command
}
