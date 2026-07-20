import { loadCliConfig } from "../config"
import { CLIError } from "../errors"
import { buildDashboardCommandStructure } from "../metadata/dashboard-metadata"
import {
  createDirectMultiQueueTransport,
  createMultiQueueTransport,
} from "../transport/multi-queue"
import type { GlobalOptions } from "../transport/with-transport"

export function createDashboardCommand() {
  const command = buildDashboardCommandStructure()

  command.action(async (options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    const effectiveUrl =
      globalOpts.url ?? process.env.VORSTEH_QUEUE_URL ?? undefined

    let transport

    if (effectiveUrl) {
      // Remote mode via GraphQL
      if (
        !effectiveUrl.startsWith("http://") &&
        !effectiveUrl.startsWith("https://")
      ) {
        throw new CLIError("Invalid URL: must start with http:// or https://")
      }

      const effectiveToken =
        globalOpts.token ?? process.env.VORSTEH_QUEUE_TOKEN ?? undefined

      transport = createMultiQueueTransport(
        effectiveUrl,
        effectiveToken,
        globalOpts.queue
      )
    } else {
      // Direct mode via queue.config.ts
      const config = await loadCliConfig()
      const queueNames = config.queues.map((q) => q.name)

      transport = createDirectMultiQueueTransport(
        config.adapter,
        queueNames,
        globalOpts.queue ?? config.defaultQueue
      )
    }

    await transport.connect()

    const refreshInterval = Math.max(500, Math.trunc(Number(options.refresh)))

    // Dynamic import to avoid loading Ink/React unless dashboard is used
    const { render } = await import("ink")
    const { createElement } = await import("react")
    const { App } = await import("../tui/app")

    // Enter alternate screen buffer (prevents ghost frames on resize)
    process.stdout.write("\u001B[?1049h")
    process.stdout.write("\u001B[H")

    const { waitUntilExit } = render(
      createElement(App, {
        initialQueue: globalOpts.queue,
        refreshInterval,
        showSidebar: options.sidebar !== false,
        transport,
      })
    )

    await waitUntilExit()

    // Exit alternate screen buffer
    process.stdout.write("\u001B[?1049l")
    await transport.disconnect()
  })

  return command
}
