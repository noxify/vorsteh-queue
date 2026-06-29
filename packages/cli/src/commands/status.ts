import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

export function createStatusCommand(transport: Transport) {
  return defineCommand({
    meta: { name: "status", description: "Show queue status overview" },
    args: {
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()
      const stats = await transport.getStats()
      const size = await transport.size()
      await transport.disconnect()

      if (args.json) {
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
    },
  })
}
