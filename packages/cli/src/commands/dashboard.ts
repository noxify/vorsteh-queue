import { CLIError } from "../errors"
import { buildDashboardCommandStructure } from "../metadata/dashboard-metadata"
import { createMultiQueueTransport } from "../transport/multi-queue"
import type { GlobalOptions } from "../transport/with-transport"

export function createDashboardCommand() {
  const command = buildDashboardCommandStructure()

  command.action(async (options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    const effectiveUrl =
      globalOpts.url ?? process.env.VORSTEH_QUEUE_URL ?? undefined

    if (!effectiveUrl) {
      throw new CLIError(
        "The --url flag or VORSTEH_QUEUE_URL environment variable is required for the dashboard."
      )
    }

    if (
      !effectiveUrl.startsWith("http://") &&
      !effectiveUrl.startsWith("https://")
    ) {
      throw new CLIError("Invalid URL: must start with http:// or https://")
    }

    const effectiveToken =
      globalOpts.token ?? process.env.VORSTEH_QUEUE_TOKEN ?? undefined

    // Create multi-queue transport — queue is optional (auto-selects first)
    const transport = createMultiQueueTransport(
      effectiveUrl,
      effectiveToken,
      globalOpts.queue
    )

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
