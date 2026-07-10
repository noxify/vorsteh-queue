import * as fc from "fast-check"
import { describe, expect, it, vi } from "vitest"

import { withTransport } from "../src/transport/with-transport"

vi.mock("../src/transport/resolve", () => ({
  resolveTransport: vi.fn(),
}))

import { resolveTransport } from "../src/transport/resolve"
const mockedResolveTransport = vi.mocked(resolveTransport)

function createMockTransport(callLog: string[]) {
  return {
    connect: vi.fn(async () => {
      callLog.push("connect")
    }),
    disconnect: vi.fn(async () => {
      callLog.push("disconnect")
    }),
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

describe("withTransport lifecycle", () => {
  // Feature: cli-remote-transport, Property 6: Lifecycle manager guarantees connect-before-callback and disconnect-after
  // **Validates: Requirements 2.2, 2.3, 2.4, 2.7**
  describe("Property 6: connect-before-callback and disconnect-after", () => {
    it("calls connect before callback and disconnect after, returning callback value", async () => {
      await fc.assert(
        fc.asyncProperty(fc.anything(), async (returnValue) => {
          const callLog: string[] = []
          const mockTransport = createMockTransport(callLog)
          mockedResolveTransport.mockResolvedValue(mockTransport)

          const result = await withTransport(
            { url: "http://example.com" },
            async (transport) => {
              callLog.push("callback")
              expect(transport).toBe(mockTransport)
              return returnValue
            }
          )

          expect(result).toBe(returnValue)
          expect(callLog).toStrictEqual(["connect", "callback", "disconnect"])
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: cli-remote-transport, Property 7: Lifecycle manager re-throws callback errors after disconnect
  // **Validates: Requirements 2.5**
  describe("Property 7: re-throws callback errors after disconnect", () => {
    it("calls disconnect and re-throws the original error from the callback", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (errorMessage) => {
          const callLog: string[] = []
          const mockTransport = createMockTransport(callLog)
          mockedResolveTransport.mockResolvedValue(mockTransport)

          const thrownError = new Error(errorMessage)

          await expect(
            withTransport({ url: "http://example.com" }, async () => {
              callLog.push("callback")
              throw thrownError
            })
          ).rejects.toBe(thrownError)

          expect(callLog).toStrictEqual(["connect", "callback", "disconnect"])
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: cli-remote-transport, Property 8: Connect failure skips disconnect
  // **Validates: Requirements 2.6**
  describe("Property 8: connect failure skips disconnect", () => {
    it("propagates connect error without calling disconnect", async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 1 }), async (errorMessage) => {
          const callLog: string[] = []
          const mockTransport = createMockTransport(callLog)
          const connectError = new Error(errorMessage)

          mockTransport.connect.mockImplementation(async () => {
            callLog.push("connect")
            throw connectError
          })

          mockedResolveTransport.mockResolvedValue(mockTransport)

          await expect(
            withTransport({ url: "http://example.com" }, async () => {
              callLog.push("callback")
              return "should not reach"
            })
          ).rejects.toBe(connectError)

          expect(callLog).toStrictEqual(["connect"])
          expect(mockTransport.disconnect).not.toHaveBeenCalled()
        }),
        { numRuns: 100 }
      )
    })
  })
})
