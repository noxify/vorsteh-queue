import * as fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CLIError } from "../src/errors"
import { createGraphQLTransport } from "../src/transport/graphql"

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

// Generators
const baseUrlArb = fc.webUrl().map((url) => url.replace(/\/$/, ""))
const graphqlUrlArb = baseUrlArb.map((base) => `${base  }/graphql`)
const tokenArb = fc.string({ minLength: 1 })
const nonOkStatusArb = fc
  .integer({ max: 599, min: 300 })
  .filter((s) => s !== 401)

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("GraphQL Transport Health Check", () => {
  // Feature: cli-remote-transport, Property 9: Health check URL derivation
  describe("Property 9: Health check URL derivation", () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any URL ending in `/graphql`, health check URL is the URL with
     * `/graphql` replaced by `/health`.
     */
    it("should derive health URL by replacing /graphql with /health", async () => {
      await fc.assert(
        fc.asyncProperty(graphqlUrlArb, async (graphqlUrl) => {
          mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

          const transport = createGraphQLTransport(graphqlUrl)
          await transport.connect()

          const expectedHealthUrl =
            `${graphqlUrl.replace(/\/graphql$/, "")  }/health`
          expect(mockFetch).toHaveBeenCalledWith(expectedHealthUrl, {
            headers: {},
            method: "GET",
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: cli-remote-transport, Property 10: Health check includes authorization when token is present
  describe("Property 10: Health check includes authorization when token is present", () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any non-empty token, the fetch call includes
     * `Authorization: Bearer <token>` header.
     */
    it("should include Authorization header when token is present", async () => {
      await fc.assert(
        fc.asyncProperty(graphqlUrlArb, tokenArb, async (graphqlUrl, token) => {
          mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

          const transport = createGraphQLTransport(graphqlUrl, token)
          await transport.connect()

          const expectedHealthUrl =
            `${graphqlUrl.replace(/\/graphql$/, "")  }/health`
          expect(mockFetch).toHaveBeenCalledWith(expectedHealthUrl, {
            headers: { Authorization: `Bearer ${token}` },
            method: "GET",
          })
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: cli-remote-transport, Property 11: Network error produces CLIError with URL
  describe("Property 11: Network error produces CLIError with URL", () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * For any URL, when fetch throws, connect() throws CLIError
     * containing the health URL.
     */
    it("should throw CLIError with health URL on network error", async () => {
      await fc.assert(
        fc.asyncProperty(graphqlUrlArb, async (graphqlUrl) => {
          mockFetch.mockRejectedValueOnce(new Error("Network failure"))

          const transport = createGraphQLTransport(graphqlUrl)
          const expectedHealthUrl =
            `${graphqlUrl.replace(/\/graphql$/, "")  }/health`

          await expect(transport.connect()).rejects.toSatisfy(
            (error: unknown) => {
              expect(error).toBeInstanceOf(CLIError)
              expect((error as CLIError).message).toContain(expectedHealthUrl)
              return true
            }
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: cli-remote-transport, Property 12: Non-200/401 status produces CLIError with status info
  describe("Property 12: Non-200/401 status produces CLIError with status info", () => {
    /**
     * **Validates: Requirements 3.7**
     *
     * For any HTTP status code that is not 200 and not 401,
     * connect() throws CLIError containing the status code and status text.
     */
    it("should throw CLIError with status code and text for non-200/401 responses", async () => {
      await fc.assert(
        fc.asyncProperty(
          graphqlUrlArb,
          nonOkStatusArb,
          fc.string({ minLength: 1 }),
          async (graphqlUrl, statusCode, statusText) => {
            mockFetch.mockResolvedValueOnce({
              ok: false,
              status: statusCode,
              statusText,
            })

            const transport = createGraphQLTransport(graphqlUrl)

            await expect(transport.connect()).rejects.toSatisfy(
              (error: unknown) => {
                expect(error).toBeInstanceOf(CLIError)
                const {message} = (error as CLIError)
                expect(message).toContain(String(statusCode))
                expect(message).toContain(statusText)
                return true
              }
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Example-based tests
  describe("Example tests", () => {
    it("should resolve successfully on 200 response (Req 3.4)", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      const transport = createGraphQLTransport("http://localhost:3000/graphql")
      await expect(transport.connect()).resolves.toBeUndefined()
    })

    it("should throw CLIError with exact multi-line message on 401 (Req 3.6)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      })

      const transport = createGraphQLTransport(
        "http://localhost:3000/graphql",
        "my-token"
      )

      await expect(transport.connect()).rejects.toThrow(
        "Request failed with 401 Unauthorized.\n" +
          "The server rejected the request.\n" +
          "This may be caused by:\n" +
          " - Missing authentication\n" +
          " - Invalid or expired token\n" +
          " - Custom authentication middleware"
      )
    })

    it("should not include Authorization header when no token is provided", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 })

      const transport = createGraphQLTransport("http://localhost:3000/graphql")
      await transport.connect()

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/health", {
        headers: {},
        method: "GET",
      })
    })
  })
})
