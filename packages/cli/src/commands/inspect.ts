import consola from "consola"

import { buildInspectCommandStructure } from "../metadata/inspect-metadata"
import type { Transport } from "../transport/types"

export function createInspectCommand(transport: Transport) {
  const command = buildInspectCommandStructure()

  command.action(async (id, options) => {
    // oxlint-disable-next-line react-doctor/async-parallel -- sequential: connect → query → disconnect
    await transport.connect()
    const job = await transport.getJob(id)
    await transport.disconnect()

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
  })

  return command
}
