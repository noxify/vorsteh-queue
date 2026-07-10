import * as fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CLIError } from "../src/errors"
import { resolveTransport } from "../src/transport/resolve"

// Mock c12 module
vi.mock("c12", () => ({
  loadConfig: vi.fn(),
}))

// Mock direct/graphql transport factories
vi.mock("../src/transport/direct", () => ({
  createDirectTransport: vi.fn((_adapter, _queueName) => ({
    type: "direct",
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

vi.mock("../src/transport/graphql", () => ({
  createGraphQLTransport: vi.fn((url, token) => ({
    type: "graphql",
    url,
    token,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

// Generators
const validUrlArb = fc
  .oneof(
    fc.webUrl({ validSchemes: ["http"] }),
    fc.webUrl({ validSchemes: ["https"] })
  )
  .map((url) => url + "/graphql")

const invalidUrlArb = fc
  .string({ minLength: 1 })
  .filter((s) => !s.startsWith("http://") && !s.startsWith("https://"))

const tokenArb = fc.string({ minLength: 1 })

describe("resolveTransport", () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe("Property 1: Transport mode selection by URL presence", () => {
    /**
     * Validates: Requirements 1.1, 1.2, 1.3
     *
     * For any URL starting with http:// or https://, resolveTransport returns
     * a graphql transport. For no URL + valid config, it returns a direct transport.
     */
    it("should return graphql transport when URL is provided via --url", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      await fc.assert(
        fc.asyncProperty(validUrlArb, async (url) => {
          delete process.env.VORSTEH_QUEUE_URL
          delete process.env.VORSTEH_QUEUE_TOKEN

          const result = (await resolveTransport({ url })) as unknown as {
            type: string
          }

          expect(result.type).toBe("graphql")
          expect(createGraphQLTransport).toHaveBeenCalledWith(url, undefined)
        }),
        { numRuns: 100 }
      )
    })

    it("should return graphql transport when URL is from env var", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      await fc.assert(
        fc.asyncProperty(validUrlArb, async (url) => {
          process.env.VORSTEH_QUEUE_URL = url
          delete process.env.VORSTEH_QUEUE_TOKEN

          const result = (await resolveTransport({})) as unknown as {
            type: string
          }

          expect(result.type).toBe("graphql")
          expect(createGraphQLTransport).toHaveBeenCalledWith(url, undefined)

          delete process.env.VORSTEH_QUEUE_URL
        }),
        { numRuns: 100 }
      )
    })

    it("should return direct transport when no URL and valid config", async () => {
      const { loadConfig } = await import("c12")
      const { createDirectTransport } = await import("../src/transport/direct")
      const mockAdapter = { setQueueName: vi.fn() }

      vi.mocked(loadConfig).mockResolvedValue({
        config: { adapter: mockAdapter, queueName: "test-queue" },
        configFile: "queue.config.ts",
        layers: [],
        cwd: "/",
      } as never)

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      const result = (await resolveTransport({})) as unknown as {
        type: string
      }

      expect(result.type).toBe("direct")
      expect(createDirectTransport).toHaveBeenCalledWith(
        mockAdapter,
        "test-queue"
      )
    })
  })

  describe("Property 2: URL source precedence", () => {
    /**
     * Validates: Requirements 1.4
     *
     * When both --url and VORSTEH_QUEUE_URL exist, --url always wins.
     */
    it("should prefer --url over VORSTEH_QUEUE_URL env var", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      await fc.assert(
        fc.asyncProperty(validUrlArb, validUrlArb, async (flagUrl, envUrl) => {
          fc.pre(flagUrl !== envUrl)

          process.env.VORSTEH_QUEUE_URL = envUrl
          delete process.env.VORSTEH_QUEUE_TOKEN

          const result = (await resolveTransport({
            url: flagUrl,
          })) as unknown as {
            type: string
            url: string
          }

          expect(result.type).toBe("graphql")
          expect(createGraphQLTransport).toHaveBeenCalledWith(
            flagUrl,
            undefined
          )

          delete process.env.VORSTEH_QUEUE_URL
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 3: Token source precedence", () => {
    /**
     * Validates: Requirements 1.7
     *
     * When both --token and VORSTEH_QUEUE_TOKEN exist, --token always wins.
     */
    it("should prefer --token over VORSTEH_QUEUE_TOKEN env var", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      await fc.assert(
        fc.asyncProperty(
          validUrlArb,
          tokenArb,
          tokenArb,
          async (url, flagToken, envToken) => {
            fc.pre(flagToken !== envToken)

            process.env.VORSTEH_QUEUE_TOKEN = envToken
            delete process.env.VORSTEH_QUEUE_URL

            await resolveTransport({ url, token: flagToken })

            expect(createGraphQLTransport).toHaveBeenCalledWith(url, flagToken)

            delete process.env.VORSTEH_QUEUE_TOKEN
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 4: Invalid URL rejection", () => {
    /**
     * Validates: Requirements 1.11
     *
     * For any string NOT starting with http:// or https://, resolveTransport
     * throws CLIError.
     */
    it("should throw CLIError for invalid URL from --url", async () => {
      await fc.assert(
        fc.asyncProperty(invalidUrlArb, async (badUrl) => {
          delete process.env.VORSTEH_QUEUE_URL

          await expect(resolveTransport({ url: badUrl })).rejects.toThrow(
            CLIError
          )
        }),
        { numRuns: 100 }
      )
    })

    it("should throw CLIError for invalid URL from env var", async () => {
      await fc.assert(
        fc.asyncProperty(invalidUrlArb, async (badUrl) => {
          process.env.VORSTEH_QUEUE_URL = badUrl

          await expect(resolveTransport({})).rejects.toThrow(CLIError)

          delete process.env.VORSTEH_QUEUE_URL
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("Property 5: Missing adapter rejection", () => {
    /**
     * Validates: Requirements 1.9
     *
     * For no URL and no adapter in config, resolveTransport throws CLIError.
     */
    it("should throw CLIError when no URL and no adapter in config", async () => {
      const { loadConfig } = await import("c12")

      vi.mocked(loadConfig).mockResolvedValue({
        config: {},
        configFile: "queue.config.ts",
        layers: [],
        cwd: "/",
      } as never)

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      await expect(resolveTransport({})).rejects.toThrow(CLIError)
      await expect(resolveTransport({})).rejects.toThrow(
        /No adapter configured/
      )
    })

    it("should throw CLIError when no URL and config is empty/null", async () => {
      const { loadConfig } = await import("c12")

      vi.mocked(loadConfig).mockResolvedValue({
        config: null,
        configFile: undefined,
        layers: [],
        cwd: "/",
      } as never)

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      await expect(resolveTransport({})).rejects.toThrow(CLIError)
    })
  })

  describe("Example tests", () => {
    it("should create GraphQL transport without token when no token is available (Req 1.8)", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      const url = "https://example.com/graphql"
      await resolveTransport({ url })

      expect(createGraphQLTransport).toHaveBeenCalledWith(url, undefined)
    })

    it("should not fail in remote mode when config file is missing (Req 1.12)", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      const url = "https://example.com/graphql"
      const result = (await resolveTransport({ url })) as unknown as {
        type: string
      }

      expect(result.type).toBe("graphql")
      expect(createGraphQLTransport).toHaveBeenCalledWith(url, undefined)
    })
  })
})
