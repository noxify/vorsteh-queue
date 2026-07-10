import consola from "consola"

import { buildInspectCommandStructure } from "../metadata/inspect-metadata"
import type { GlobalOptions } from "../transport/with-transport"
import { withTransport } from "../transport/with-transport"

export function createInspectCommand() {
  const command = buildInspectCommandStructure()

  command.action(async (id, options, command) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    await withTransport(
      { url: globalOpts.url, token: globalOpts.token },
      async (transport) => {
        const job = await transport.getJob(id)

        if (!job) {
          consola.error(`Job "${id}" not found`)
          return
        }

        if (options.json) {
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
      }
    )
  })

  return command
}
