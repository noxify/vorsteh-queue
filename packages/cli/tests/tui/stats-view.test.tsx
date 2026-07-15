import { render } from "ink-testing-library"
import { afterEach, describe, expect, it } from "vitest"

import { TransportProvider } from "../../src/tui/context"
import { StatsView } from "../../src/tui/views/stats"
import { createMockTransport, DEFAULT_STATS } from "../helpers/mock-transport"

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

describe("TUI: StatsView", () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it("should display queue stats after loading", async () => {
    const transport = createMockTransport()

    const { lastFrame, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <StatsView refreshInterval={5000} />
      </TransportProvider>
    )
    cleanup = unmount

    // Wait for async load
    await wait(50)

    const frame = lastFrame()
    expect(frame).toContain("Pending")
    expect(frame).toContain(String(DEFAULT_STATS.pending))
    expect(frame).toContain("Completed")
    expect(frame).toContain(String(DEFAULT_STATS.completed))
    expect(frame).toContain("Failed")
    expect(frame).toContain(String(DEFAULT_STATS.failed))
    expect(frame).toContain("Dead")
    expect(frame).toContain(String(DEFAULT_STATS.dead))
  })

  it("should show loading initially", () => {
    const transport = createMockTransport()
    // Make getStats hang
    transport.getStats = () => new Promise(() => {})

    const { lastFrame, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <StatsView refreshInterval={5000} />
      </TransportProvider>
    )
    cleanup = unmount

    expect(lastFrame()).toContain("Loading")
  })

  it("should show error on transport failure", async () => {
    const transport = createMockTransport()
    transport.getStats = async () => {
      throw new Error("Connection refused")
    }

    const { lastFrame, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <StatsView refreshInterval={5000} />
      </TransportProvider>
    )
    cleanup = unmount

    await wait(50)

    expect(lastFrame()).toContain("Error")
    expect(lastFrame()).toContain("Connection refused")
  })
})
