import { defineCommand } from "citty"
import consola from "consola"

import type { Transport } from "../transport/types"

export function createInspectCommand(transport: Transport) {
  return defineCommand({
    meta: { name: "inspect", description: "Show details of a specific job" },
    args: {
      id: {
        type: "positional",
        description: "Job ID to inspect",
        required: true,
      },
      json: { type: "boolean", description: "Output as JSON", default: false },
    },
    async run({ args }) {
      await transport.connect()
      const job = await transport.getJob(args.id)
      await transport.disconnect()

      if (!job) {
        consola.error(`Job "${args.id}" not found`)
        return
      }

      if (args.json) {
        consola.log(JSON.stringify(job, null, 2))
        return
      }

      consola.info(`Job: ${job.id}`)
      consola.log(`  Name:       ${job.name}`)
      consola.log(`  Status:     ${job.status}`)
      consola.log(`  Priority:   ${job.priority}`)
      consola.log(`  Attempts:   ${job.attempts}/${job.maxAttempts}`)
      consola.log(`  Progress:   ${job.progress}%`)
      consola.log(`  Created:    ${job.createdAt}`)
      consola.log(`  Process At: ${job.processAt}`)
      if (job.groupKey) {
        consola.log(`  Group:      ${job.groupKey}`)
      }
      if (job.error) {
        consola.log(`  Error:      ${job.error.message}`)
      }
      if (job.result) {
        consola.log(`  Result:     ${JSON.stringify(job.result)}`)
      }
      consola.log(`  Payload:    ${JSON.stringify(job.payload)}`)
    },
  })
}
