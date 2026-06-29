import consola from "consola"

import { buildRedriveCommandStructure } from "../metadata/redrive-metadata"
import type { Transport } from "../transport/types"

export function createRedriveCommand(transport: Transport) {
  const command = buildRedriveCommandStructure()

  command.action(async (id, options) => {
    await transport.connect()

    if (options.all) {
      const count = await transport.redriveAll(
        options.name ? { name: options.name } : undefined
      )
      await transport.disconnect()

      if (options.json) {
        consola.log(JSON.stringify({ redriven: count }))
        return
      }
      consola.success(`Redriven ${count} dead job(s)`)
      return
    }

    if (!id) {
      consola.error("Provide a job ID or use --all")
      await transport.disconnect()
      return
    }

    await transport.redriveJob(id)
    await transport.disconnect()

    if (options.json) {
      consola.log(JSON.stringify({ success: true, id }))
      return
    }
    consola.success(`Job "${id}" redriven to pending`)
  })

  return command
}
