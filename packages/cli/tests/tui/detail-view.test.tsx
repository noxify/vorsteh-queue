import { render } from "ink-testing-library"
import { afterEach, describe, expect, it } from "vitest"

import { DashboardProvider } from "../../src/tui/context"
import { JobDetailDrawer } from "../../src/tui/views/detail"
import { createMockMultiQueueTransport } from "../helpers/mock-transport"

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

describe("TUI: DetailView", () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it("should show loading when no job is selected", () => {
    const transport = createMockMultiQueueTransport()

    const { lastFrame, unmount } = render(
      <DashboardProvider
        transport={transport}
        refreshInterval={5000}
        initialQueue="test-queue"
      >
        <JobDetailDrawer isFocused />
      </DashboardProvider>
    )
    cleanup = unmount

    // selectedJobId is null by default, so DetailView shows spinner
    expect(lastFrame()).toContain("Loading")
  })

  it("should show loading when getJob hangs", () => {
    const transport = createMockMultiQueueTransport()
    transport.getJob = () => new Promise(() => {})

    const { lastFrame, unmount } = render(
      <DashboardProvider
        transport={transport}
        refreshInterval={5000}
        initialQueue="test-queue"
      >
        <JobDetailDrawer isFocused />
      </DashboardProvider>
    )
    cleanup = unmount

    expect(lastFrame()).toContain("Loading")
  })

  it("should render without crash when focused", async () => {
    const transport = createMockMultiQueueTransport({
      job: {
        attempts: 1,
        createdAt: new Date("2026-01-01T12:00:00Z"),
        id: "detail-job-1",
        maxAttempts: 3,
        name: "send-notification",
        payload: { type: "welcome", userId: "u-123" },
        priority: 1,
        processAt: new Date("2026-01-01T12:00:00Z"),
        progress: 75,
        repeatCount: 0,
        status: "processing",
      },
    })

    const { lastFrame, unmount } = render(
      <DashboardProvider
        transport={transport}
        refreshInterval={5000}
        initialQueue="test-queue"
      >
        <JobDetailDrawer isFocused />
      </DashboardProvider>
    )
    cleanup = unmount

    await wait(50)

    // No selectedJobId → still loading
    const frame = lastFrame()
    expect(frame).toContain("Loading")
  })
})
