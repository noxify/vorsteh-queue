import consola from "consola"

import { loadCliConfig } from "../config"
import { buildServeCommandStructure } from "../metadata/serve-metadata"

export function createServeCommand() {
  const command = buildServeCommandStructure()

  command.action(async (options) => {
    const transport = await loadCliConfig()

    if (transport.type !== "direct") {
      consola.error(
        "The serve command requires a direct adapter configuration."
      )
      consola.info(
        "Add an adapter to your queue.config.ts to use the serve command."
      )
      // eslint-disable-next-line no-restricted-properties, unicorn/no-process-exit
      process.exit(1)
    }

    // Dynamic import to avoid loading server deps unless needed
    const { createQueueServer } = await import("@vorsteh-queue/server")

    const port = options.port ? Number.parseInt(options.port, 10) : undefined
    const { dashboard } = options

    const server = createQueueServer({
      adapter: transport.adapter,
      queueName: transport.queueName,
      port,
      dashboard,
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
