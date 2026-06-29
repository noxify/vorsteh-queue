import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

export function createRetryCommand(transport: Transport) {
  return defineCommand({
    meta: { name: "retry", description: "Retry a failed job" },
    args: {
      id: {
        type: "positional",
        description: "Job ID to retry",
        required: true,
      },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()
      const success = await transport.retryJob(args.id)
      await transport.disconnect()

      if (args.json) {
        consola.log(JSON.stringify({ success, id: args.id }))
        return
      }

      if (success) {
        consola.success(`Job "${args.id}" retried (reset to pending)`)
      } else {
        consola.warn(
          `Could not retry job "${args.id}" (must be in "failed" status)`
        )
      }
    },
  })
}
