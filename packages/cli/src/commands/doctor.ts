import consola from "consola"

import { buildDoctorCommandStructure } from "../metadata/doctor-metadata"
import { resolveTransport } from "../transport/resolve"
import type { GlobalOptions } from "../transport/with-transport"

export function createDoctorCommand() {
  const command = buildDoctorCommandStructure()

  command.action(async () => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions

    const transport = await resolveTransport(globalOpts)
    const isRemote = !!globalOpts.url || !!process.env.VORSTEH_QUEUE_URL

    if (isRemote) {
      const url = globalOpts.url ?? process.env.VORSTEH_QUEUE_URL
      const hasToken = !!(globalOpts.token ?? process.env.VORSTEH_QUEUE_TOKEN)
      consola.info("Mode:           Remote")
      consola.info(`Endpoint:       ${url}`)
      consola.info(`Authentication: ${hasToken ? "bearer token" : "none"}`)
    } else {
      consola.info("Mode:           Direct")
      consola.info("Adapter:        configured via queue.config.ts")
    }

    try {
      await transport.connect()
      await transport.disconnect()
      consola.success("Connection:     OK")
      process.exitCode = 0
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error"
      consola.error(`Connection:     FAILED`)
      consola.error(`Reason:         ${message}`)
      process.exitCode = 1
    }
  })

  return command
}
