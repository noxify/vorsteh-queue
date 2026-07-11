import consola from "consola"

import { loadCliConfig } from "../config"
import { buildServeCommandStructure } from "../metadata/serve-metadata"

export function createServeCommand() {
  const command = buildServeCommandStructure()

  command.action(async (options) => {
    const config = await loadCliConfig()

    // Dynamic import to avoid loading server deps unless needed
    const { createQueueServer } = await import("@vorsteh-queue/server")

    const port = options.port ? Math.trunc(Number(options.port)) : undefined

    const server = createQueueServer({
      queues: config.queues,
      port,
    })

    await server.start()

    // Graceful shutdown
    const shutdown = async () => {
      consola.info("Shutting down...")
      await server.stop()
      // eslint-disable-next-line no-restricted-properties, unicorn/no-process-exit
      process.exit(0)
    }

    // eslint-disable-next-line no-restricted-properties
    process.on("SIGINT", shutdown)
    // eslint-disable-next-line no-restricted-properties
    process.on("SIGTERM", shutdown)
  })

  return command
}
