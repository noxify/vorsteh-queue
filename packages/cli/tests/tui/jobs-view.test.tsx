import type { Job } from "@vorsteh-queue/core"
import { render } from "ink-testing-library"
import { afterEach, describe, expect, it } from "vitest"

import { DashboardProvider } from "../../src/tui/context"
import { JobsView } from "../../src/tui/views/jobs"
import { createMockMultiQueueTransport } from "../helpers/mock-transport"

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const mockJobs: readonly Job[] = [
  {
    attempts: 0,
    createdAt: new Date("2026-01-01"),
    id: "job-1",
    maxAttempts: 3,
    name: "send-email",
    payload: {},
    priority: 1,
    processAt: new Date("2026-01-01"),
    progress: 0,
    repeatCount: 0,
    status: "pending",
  },
  {
    attempts: 2,
    createdAt: new Date("2026-01-02"),
    id: "job-2",
    maxAttempts: 3,
    name: "generate-report",
    payload: {},
    priority: 2,
    processAt: new Date("2026-01-02"),
    progress: 50,
    repeatCount: 0,
    status: "processing",
  },
  {
    attempts: 3,
    createdAt: new Date("2026-01-03"),
    error: { message: "timeout", name: "TimeoutError" },
    id: "job-3",
    maxAttempts: 3,
    name: "sync-data",
    payload: {},
    priority: 3,
    processAt: new Date("2026-01-03"),
    progress: 0,
    repeatCount: 0,
    status: "failed",
  },
]

describe("TUI: JobsView", () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it("should display job list after loading", async () => {
    const transport = createMockMultiQueueTransport({ jobs: mockJobs })

    const { lastFrame, unmount } = render(
      <DashboardProvider
        transport={transport}
        refreshInterval={5000}
        initialQueue="test-queue"
      >
        <JobsView isFocused={false} />
      </DashboardProvider>
    )
    cleanup = unmount

    await wait(50)

    const frame = lastFrame()
    expect(frame).toContain("send-email")
    expect(frame).toContain("generate-report")
    expect(frame).toContain("sync-data")
    expect(frame).toContain("pending")
    expect(frame).toContain("processing")
    expect(frame).toContain("failed")
  })

  it("should show filter bar", async () => {
    const transport = createMockMultiQueueTransport({ jobs: mockJobs })

    const { lastFrame, unmount } = render(
      <DashboardProvider
        transport={transport}
        refreshInterval={5000}
        initialQueue="test-queue"
      >
        <JobsView isFocused={false} />
      </DashboardProvider>
    )
    cleanup = unmount

    await wait(50)

    const frame = lastFrame()
    expect(frame).toContain("Status")
    expect(frame).toContain("all")
  })

  it("should show empty state when no jobs", async () => {
    const transport = createMockMultiQueueTransport({ jobs: [] })

    const { lastFrame, unmount } = render(
      <DashboardProvider
        transport={transport}
        refreshInterval={5000}
        initialQueue="test-queue"
      >
        <JobsView isFocused={false} />
      </DashboardProvider>
    )
    cleanup = unmount

    await wait(50)

    expect(lastFrame()).toContain("No jobs found")
  })

  it("should display pagination info", async () => {
    const transport = createMockMultiQueueTransport({ jobs: mockJobs })

    const { lastFrame, unmount } = render(
      <DashboardProvider
        transport={transport}
        refreshInterval={5000}
        initialQueue="test-queue"
      >
        <JobsView isFocused={false} />
      </DashboardProvider>
    )
    cleanup = unmount

    await wait(50)

    const frame = lastFrame()
    expect(frame).toContain("3 of")
    expect(frame).toContain("Status")
  })
})
