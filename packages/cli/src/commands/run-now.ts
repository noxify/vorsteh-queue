import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

export function createRunNowCommand(transport: Transport) {
  return defineCommand({
    meta: {
      name: "run-now",
      description: "Promote a delayed job to run immediately",
    },
    args: {
      id: {
        type: "positional",
        description: "Job ID to promote",
        required: true,
      },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()
      const success = await transport.runJobNow(args.id)
      await transport.disconnect()

      if (args.json) {
        consola.log(JSON.stringify({ success, id: args.id }))
        return
      }

      if (success) {
        consola.success(
          `Job "${args.id}" promoted to pending (will run immediately)`
        )
      } else {
        consola.warn(
          `Could not promote job "${args.id}" (must be in "delayed" status)`
        )
      }
    },
  })
}
