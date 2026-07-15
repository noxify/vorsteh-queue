import { buildDashboardCommandStructure } from "../metadata/dashboard-metadata"
import { resolveTransport } from "../transport/resolve"
import type { GlobalOptions } from "../transport/with-transport"

export function createDashboardCommand() {
  const command = buildDashboardCommandStructure()

  command.action(async (options) => {
    const globalOpts = command.optsWithGlobals() as GlobalOptions &
      typeof options

    const transport = await resolveTransport({
      queue: globalOpts.queue,
      token: globalOpts.token,
      url: globalOpts.url,
    })
    await transport.connect()

    const refreshInterval = Math.max(500, Math.trunc(Number(options.refresh)))

    // Dynamic import to avoid loading Ink/React unless dashboard is used
    const { render } = await import("ink")
    const { createElement } = await import("react")
    const { App } = await import("../tui/app")

    const { waitUntilExit } = render(
      createElement(App, { refreshInterval, transport })
    )

    await waitUntilExit()
    await transport.disconnect()
  })

  return command
}
