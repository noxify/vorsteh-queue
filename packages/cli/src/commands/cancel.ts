import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

export function createCancelCommand(transport: Transport) {
  return defineCommand({
    meta: { name: "cancel", description: "Cancel a job" },
    args: {
      id: {
        type: "positional",
        description: "Job ID to cancel",
        required: true,
      },
      reason: { type: "string", description: "Cancellation reason" },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()
      const success = await transport.cancelJob(args.id, args.reason)
      await transport.disconnect()

      if (args.json) {
        consola.log(JSON.stringify({ success, id: args.id }))
        return
      }

      if (success) {
        consola.success(`Job "${args.id}" cancelled`)
      } else {
        consola.warn(
          `Could not cancel job "${args.id}" (may already be in terminal state)`
        )
      }
    },
  })
}
