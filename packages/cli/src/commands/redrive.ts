import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

export function createRedriveCommand(transport: Transport) {
  return defineCommand({
    meta: {
      name: "redrive",
      description: "Redrive a dead job (or all dead jobs)",
    },
    args: {
      id: {
        type: "positional",
        description: "Job ID to redrive (omit for --all)",
      },
      all: {
        type: "boolean",
        description: "Redrive all dead jobs",
        default: false,
      },
      name: {
        type: "string",
        description: "Filter by job name (used with --all)",
      },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()

      if (args.all) {
        const count = await transport.redriveAll(
          args.name ? { name: args.name } : undefined
        )
        await transport.disconnect()

        if (args.json) {
          consola.log(JSON.stringify({ redriven: count }))
          return
        }
        consola.success(`Redriven ${count} dead job(s)`)
        return
      }

      if (!args.id) {
        consola.error("Provide a job ID or use --all")
        await transport.disconnect()
        return
      }

      await transport.redriveJob(args.id)
      await transport.disconnect()

      if (args.json) {
        consola.log(JSON.stringify({ success: true, id: args.id }))
        return
      }
      consola.success(`Job "${args.id}" redriven to pending`)
    },
  })
}
