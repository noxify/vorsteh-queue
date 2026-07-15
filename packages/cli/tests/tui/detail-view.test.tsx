import { render } from "ink-testing-library"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import { TransportProvider } from "../../src/tui/context"
import { DetailView } from "../../src/tui/views/detail"
import { createMockTransport } from "../helpers/mock-transport"

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

describe("TUI: DetailView", () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it("should display job details", async () => {
    const transport = createMockTransport({
      job: {
        attempts: 1,
        createdAt: new Date("2026-01-01T12:00:00Z"),
        id: "detail-job-1",
        maxAttempts: 3,
        name: "send-notification",
        payload: { userId: "u-123", type: "welcome" },
        priority: 1,
        processAt: new Date("2026-01-01T12:00:00Z"),
        progress: 75,
        repeatCount: 0,
        status: "processing",
      },
    })

    const onBack = vi.fn()

    const { lastFrame, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <MemoryRouter initialEntries={["/jobs/detail-job-1"]}>
          <Routes>
            <Route
              path="/jobs/:jobId"
              element={<DetailView onBack={onBack} />}
            />
          </Routes>
        </MemoryRouter>
      </TransportProvider>
    )
    cleanup = unmount

    await wait(50)

    const frame = lastFrame()
    expect(frame).toContain("detail-job-1")
    expect(frame).toContain("send-notification")
    expect(frame).toContain("processing")
    expect(frame).toContain("1 / 3")
    expect(frame).toContain("75%")
    expect(frame).toContain("userId")
  })

  it("should show loading when job is not yet fetched", () => {
    const transport = createMockTransport()
    transport.getJob = () => new Promise(() => {})

    const { lastFrame, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <MemoryRouter initialEntries={["/jobs/job-1"]}>
          <Routes>
            <Route
              path="/jobs/:jobId"
              element={<DetailView onBack={() => {}} />}
            />
          </Routes>
        </MemoryRouter>
      </TransportProvider>
    )
    cleanup = unmount

    expect(lastFrame()).toContain("Loading")
  })

  it("should display error information when job has error", async () => {
    const transport = createMockTransport({
      job: {
        attempts: 3,
        createdAt: new Date("2026-01-01"),
        error: { message: "Connection timeout", name: "TimeoutError" },
        failedAt: new Date("2026-01-01T01:00:00Z"),
        id: "failed-job",
        maxAttempts: 3,
        name: "sync-data",
        payload: {},
        priority: 2,
        processAt: new Date("2026-01-01"),
        progress: 0,
        repeatCount: 0,
        status: "failed",
      },
    })

    const { lastFrame, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <MemoryRouter initialEntries={["/jobs/failed-job"]}>
          <Routes>
            <Route
              path="/jobs/:jobId"
              element={<DetailView onBack={() => {}} />}
            />
          </Routes>
        </MemoryRouter>
      </TransportProvider>
    )
    cleanup = unmount

    await wait(50)

    const frame = lastFrame()
    expect(frame).toContain("TimeoutError")
    expect(frame).toContain("Connection timeout")
    expect(frame).toContain("failed")
  })

  it("should call transport.cancelJob when action confirmed", async () => {
    const transport = createMockTransport()

    const { stdin, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <MemoryRouter initialEntries={["/jobs/job-1"]}>
          <Routes>
            <Route
              path="/jobs/:jobId"
              element={<DetailView onBack={() => {}} />}
            />
          </Routes>
        </MemoryRouter>
      </TransportProvider>
    )
    cleanup = unmount

    await wait(50)

    // Press 'c' for cancel, then 'y' to confirm
    stdin.write("c")
    await wait(20)
    stdin.write("y")
    await wait(50)

    expect(transport.cancelJob).toHaveBeenCalledWith(
      "job-1",
      "Cancelled via TUI"
    )
  })

  it("should call transport.retryJob when retry confirmed", async () => {
    const transport = createMockTransport()

    const { stdin, unmount } = render(
      <TransportProvider transport={transport} refreshInterval={5000}>
        <MemoryRouter initialEntries={["/jobs/job-1"]}>
          <Routes>
            <Route
              path="/jobs/:jobId"
              element={<DetailView onBack={() => {}} />}
            />
          </Routes>
        </MemoryRouter>
      </TransportProvider>
    )
    cleanup = unmount

    await wait(50)

    stdin.write("r")
    await wait(20)
    stdin.write("y")
    await wait(50)

    expect(transport.retryJob).toHaveBeenCalledWith("job-1")
  })
})
