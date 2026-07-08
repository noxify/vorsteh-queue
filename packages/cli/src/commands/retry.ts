import consola from "consola"

import { buildRetryCommandStructure } from "../metadata/retry-metadata"
import type { Transport } from "../transport/types"

export function createRetryCommand(transport: Transport) {
  const command = buildRetryCommandStructure()

  command.action(async (id, options) => {
    // oxlint-disable-next-line react-doctor/async-parallel -- sequential: connect → query → disconnect
    await transport.connect()
    const success = await transport.retryJob(id)
    await transport.disconnect()

    if (options.json) {
      consola.log(JSON.stringify({ success, id }))
      return
    }

    if (success) {
      consola.success(`Job "${id}" retried (reset to pending)`)
    } else {
      consola.warn(`Could not retry job "${id}" (must be in "failed" status)`)
    }
  })

  return command
}
