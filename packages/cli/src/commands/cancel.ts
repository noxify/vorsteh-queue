import consola from "consola"

import { buildCancelCommandStructure } from "../metadata/cancel-metadata"
import type { Transport } from "../transport/types"

export function createCancelCommand(transport: Transport) {
  const command = buildCancelCommandStructure()

  command.action(async (id, options) => {
    // oxlint-disable-next-line react-doctor/async-parallel -- sequential: connect → query → disconnect
    await transport.connect()
    const success = await transport.cancelJob(id, options.reason)
    await transport.disconnect()

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
  })

  return command
}
