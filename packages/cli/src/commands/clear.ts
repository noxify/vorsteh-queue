import type { JobStatus } from "@vorsteh-queue/core"
import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

const VALID_STATUSES = [
  "pending",
  "delayed",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "dead",
]

export function createClearCommand(transport: Transport) {
  return defineCommand({
    meta: { name: "clear", description: "Clear jobs from the queue" },
    args: {
      status: {
        type: "string",
        description: "Status to clear (pending, completed, failed, etc.)",
      },
      all: {
        type: "boolean",
        description: "Clear all jobs regardless of status",
        default: false,
      },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      if (!args.all && !args.status) {
        consola.error("Specify --status or --all")
        return
      }

      if (args.status && !VALID_STATUSES.includes(args.status)) {
        consola.error(
          `Invalid status "${args.status}". Valid: ${VALID_STATUSES.join(", ")}`
        )
        return
      }

      await transport.connect()
      const count = await transport.clearJobs(
        args.all ? undefined : (args.status as JobStatus)
      )
      await transport.disconnect()

      if (args.json) {
        consola.log(JSON.stringify({ cleared: count }))
        return
      }
      consola.success(`Cleared ${count} job(s)`)
    },
  })
}
