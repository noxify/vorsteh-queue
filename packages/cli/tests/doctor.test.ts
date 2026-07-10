import { Command } from "@commander-js/extra-typings"
import consola from "consola"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createDoctorCommand } from "../src/commands/doctor"
import { createTokenOption, createUrlOption } from "../src/options"

vi.mock("../src/transport/resolve", () => ({
  resolveTransport: vi.fn(),
}))

import { resolveTransport } from "../src/transport/resolve"
const mockedResolveTransport = vi.mocked(resolveTransport)

function createMockTransport(
  connectBehavior: () => Promise<void> = async () => {}
) {
  return {
    connect: vi.fn(connectBehavior),
    disconnect: vi.fn(async () => {}),
    getStats: vi.fn(),
    getJob: vi.fn(),
    getDeadJobs: vi.fn(),
    cancelJob: vi.fn(),
    retryJob: vi.fn(),
    runJobNow: vi.fn(),
    deleteJob: vi.fn(),
    redriveJob: vi.fn(),
    redriveAll: vi.fn(),
    clearJobs: vi.fn(),
    size: vi.fn(),
    getFlowTree: vi.fn(),
  }
}

function createTestProgram(args: string[]) {
  const program = new Command()
  program
    .addOption(createUrlOption())
    .addOption(createTokenOption())
    .addCommand(createDoctorCommand())
  return program.parseAsync(["node", "test", "doctor", ...args])
}

describe("doctor command", () => {
  let consolaMessages: { type: string; message: string }[]

  beforeEach(() => {
    consolaMessages = []

    vi.spyOn(consola, "info").mockImplementation((...args: unknown[]) => {
      consolaMessages.push({ type: "info", message: String(args[0]) })
    })
    vi.spyOn(consola, "success").mockImplementation((...args: unknown[]) => {
      consolaMessages.push({ type: "success", message: String(args[0]) })
    })
    vi.spyOn(consola, "error").mockImplementation((...args: unknown[]) => {
      consolaMessages.push({ type: "error", message: String(args[0]) })
    })

    process.exitCode = undefined
    delete process.env.VORSTEH_QUEUE_URL
    delete process.env.VORSTEH_QUEUE_TOKEN
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // **Validates: Requirements 5.2**
  describe("direct mode display", () => {
    it("displays mode as Direct and adapter info when no URL is configured", async () => {
      const mockTransport = createMockTransport()
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram([])

      const messages = consolaMessages.map((m) => m.message)
      expect(messages).toContain("Mode:           Direct")
      expect(messages).toContain(
        "Adapter:        configured via queue.config.ts"
      )
    })
  })

  // **Validates: Requirements 5.3**
  describe("remote mode display", () => {
    it("displays mode as Remote with endpoint and auth status when URL is provided", async () => {
      const mockTransport = createMockTransport()
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram([
        "--url",
        "http://localhost:3000/graphql",
        "--token",
        "my-token",
      ])

      const messages = consolaMessages.map((m) => m.message)
      expect(messages).toContain("Mode:           Remote")
      expect(messages).toContain(
        "Endpoint:       http://localhost:3000/graphql"
      )
      expect(messages).toContain("Authentication: bearer token")
    })

    it("displays authentication as none when no token is provided", async () => {
      const mockTransport = createMockTransport()
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram(["--url", "http://localhost:3000/graphql"])

      const messages = consolaMessages.map((m) => m.message)
      expect(messages).toContain("Mode:           Remote")
      expect(messages).toContain("Authentication: none")
    })

    it("detects remote mode via VORSTEH_QUEUE_URL env var", async () => {
      process.env.VORSTEH_QUEUE_URL = "http://remote-server:4000/graphql"
      const mockTransport = createMockTransport()
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram([])

      const messages = consolaMessages.map((m) => m.message)
      expect(messages).toContain("Mode:           Remote")
      expect(messages).toContain(
        "Endpoint:       http://remote-server:4000/graphql"
      )
    })
  })

  // **Validates: Requirements 5.5**
  describe("connection OK display", () => {
    it("displays Connection: OK when connect succeeds", async () => {
      const mockTransport = createMockTransport()
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram([])

      const messages = consolaMessages.map((m) => m.message)
      expect(messages).toContain("Connection:     OK")
      expect(mockTransport.connect).toHaveBeenCalledOnce()
      expect(mockTransport.disconnect).toHaveBeenCalledOnce()
    })
  })

  // **Validates: Requirements 5.6**
  describe("exitCode 0 on success", () => {
    it("sets process.exitCode to 0 when connection succeeds", async () => {
      const mockTransport = createMockTransport()
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram([])

      expect(process.exitCode).toBe(0)
    })
  })

  // **Validates: Requirements 5.7**
  describe("failure message and exitCode 1", () => {
    it("displays FAILED with reason and sets exitCode to 1 when connect throws", async () => {
      const mockTransport = createMockTransport(async () => {
        throw new Error("Connection refused")
      })
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram([])

      const messages = consolaMessages.map((m) => m.message)
      expect(messages).toContain("Connection:     FAILED")
      expect(messages).toContain("Reason:         Connection refused")
      expect(process.exitCode).toBe(1)
    })

    it("displays Unknown error when connect throws a non-Error value", async () => {
      const mockTransport = createMockTransport(async () => {
        throw "string error" // eslint-disable-line no-throw-literal
      })
      mockedResolveTransport.mockResolvedValue(mockTransport)

      await createTestProgram([])

      const messages = consolaMessages.map((m) => m.message)
      expect(messages).toContain("Connection:     FAILED")
      expect(messages).toContain("Reason:         Unknown error")
      expect(process.exitCode).toBe(1)
    })
  })
})
