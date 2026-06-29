import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

export function createDeleteCommand(transport: Transport) {
  return defineCommand({
    meta: { name: "delete", description: "Delete a single job" },
    args: {
      id: {
        type: "positional",
        description: "Job ID to delete",
        required: true,
      },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()
      const success = await transport.deleteJob(args.id)
      await transport.disconnect()

      if (args.json) {
        consola.log(JSON.stringify({ success, id: args.id }))
        return
      }

      if (success) {
        consola.success(`Job "${args.id}" deleted`)
      } else {
        consola.warn(`Could not delete job "${args.id}" (not found)`)
      }
    },
  })
}
