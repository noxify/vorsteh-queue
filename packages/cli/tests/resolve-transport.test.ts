import * as fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CLIError } from "../src/errors"
import { resolveTransport } from "../src/transport/resolve"

// Mock config module (replaces old c12 mock)
vi.mock("../src/config", () => ({
  loadCliConfig: vi.fn(),
}))

// Mock direct/graphql transport factories
vi.mock("../src/transport/direct", () => ({
  createDirectTransport: vi.fn((_adapter, _queueName) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    type: "direct",
  })),
}))

vi.mock("../src/transport/graphql", () => ({
  createGraphQLTransport: vi.fn((url, token, _queueName) => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    token,
    type: "graphql",
    url,
  })),
}))

// Generators
const validUrlArb = fc
  .oneof(
    fc.webUrl({ validSchemes: ["http"] }),
    fc.webUrl({ validSchemes: ["https"] })
  )
  .map((url) => `${url}/graphql`)

const invalidUrlArb = fc
  .string({ minLength: 1 })
  .filter((s) => !s.startsWith("http://") && !s.startsWith("https://"))

const tokenArb = fc.string({ minLength: 1 })

const queueNameArb = fc
  .string({ maxLength: 255, minLength: 1 })
  .filter((s) => s.trim().length > 0)

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
     * Validates: Requirements 1.1, 1.2, 1.3, 6.1, 6.3
     *
     * For any URL starting with http:// or https:// with a queue name,
     * resolveTransport returns a graphql transport.
     * For no URL + valid config, it returns a direct transport.
     */
    it("should return graphql transport when URL is provided via --url", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      await fc.assert(
        fc.asyncProperty(validUrlArb, queueNameArb, async (url, queue) => {
          delete process.env.VORSTEH_QUEUE_URL
          delete process.env.VORSTEH_QUEUE_TOKEN

          const result = (await resolveTransport({
            queue,
            url,
          })) as unknown as {
            type: string
          }

          expect(result.type).toBe("graphql")
          expect(createGraphQLTransport).toHaveBeenCalledWith(
            url,
            undefined,
            queue
          )
        }),
        { numRuns: 100 }
      )
    })

    it("should return graphql transport when URL is from env var", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      await fc.assert(
        fc.asyncProperty(validUrlArb, queueNameArb, async (url, queue) => {
          process.env.VORSTEH_QUEUE_URL = url
          delete process.env.VORSTEH_QUEUE_TOKEN

          const result = (await resolveTransport({ queue })) as unknown as {
            type: string
          }

          expect(result.type).toBe("graphql")
          expect(createGraphQLTransport).toHaveBeenCalledWith(
            url,
            undefined,
            queue
          )

          delete process.env.VORSTEH_QUEUE_URL
        }),
        { numRuns: 100 }
      )
    })

    it("should return direct transport when no URL and valid config", async () => {
      const { loadCliConfig } = await import("../src/config")
      const { createDirectTransport } = await import("../src/transport/direct")
      const mockAdapter = { setQueueName: vi.fn() }
      const mockQueue = { adapter: mockAdapter, name: "test-queue" }

      vi.mocked(loadCliConfig).mockResolvedValue({
        adapter: mockAdapter,
        queues: [mockQueue],
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
        fc.asyncProperty(
          validUrlArb,
          validUrlArb,
          queueNameArb,
          async (flagUrl, envUrl, queue) => {
            fc.pre(flagUrl !== envUrl)

            process.env.VORSTEH_QUEUE_URL = envUrl
            delete process.env.VORSTEH_QUEUE_TOKEN

            const result = (await resolveTransport({
              queue,
              url: flagUrl,
            })) as unknown as {
              type: string
              url: string
            }

            expect(result.type).toBe("graphql")
            expect(createGraphQLTransport).toHaveBeenCalledWith(
              flagUrl,
              undefined,
              queue
            )

            delete process.env.VORSTEH_QUEUE_URL
          }
        ),
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
          queueNameArb,
          async (url, flagToken, envToken, queue) => {
            fc.pre(flagToken !== envToken)

            process.env.VORSTEH_QUEUE_TOKEN = envToken
            delete process.env.VORSTEH_QUEUE_URL

            await resolveTransport({ queue, token: flagToken, url })

            expect(createGraphQLTransport).toHaveBeenCalledWith(
              url,
              flagToken,
              queue
            )

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
      const { loadCliConfig } = await import("../src/config")

      vi.mocked(loadCliConfig).mockRejectedValue(
        new CLIError(
          "No adapter configured. Create a queue.config.ts with an adapter, or provide --url for remote mode."
        )
      )

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      await expect(resolveTransport({})).rejects.toThrow(CLIError)
      await expect(resolveTransport({})).rejects.toThrow(
        /No adapter configured/
      )
    })

    it("should throw CLIError when no URL and config is empty/null", async () => {
      const { loadCliConfig } = await import("../src/config")

      vi.mocked(loadCliConfig).mockRejectedValue(
        new CLIError(
          "No adapter configured. Create a queue.config.ts with an adapter, or provide --url for remote mode."
        )
      )

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      await expect(resolveTransport({})).rejects.toThrow(CLIError)
    })
  })

  describe("Property 6: Remote mode requires --queue flag", () => {
    /**
     * Validates: Requirements 4.3, 4.4
     *
     * In remote mode without a config, --queue is required.
     */
    it("should throw CLIError when URL provided but no --queue flag", async () => {
      await fc.assert(
        fc.asyncProperty(validUrlArb, async (url) => {
          delete process.env.VORSTEH_QUEUE_URL
          delete process.env.VORSTEH_QUEUE_TOKEN

          await expect(resolveTransport({ url })).rejects.toThrow(CLIError)
          await expect(resolveTransport({ url })).rejects.toThrow(
            /--queue flag is required/
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  describe("Example tests", () => {
    it("should create GraphQL transport without token when no token is available (Req 1.8)", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      const url = "https://example.com/graphql"
      await resolveTransport({ queue: "my-queue", url })

      expect(createGraphQLTransport).toHaveBeenCalledWith(
        url,
        undefined,
        "my-queue"
      )
    })

    it("should not fail in remote mode when config file is missing (Req 1.12)", async () => {
      const { createGraphQLTransport } =
        await import("../src/transport/graphql")

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      const url = "https://example.com/graphql"
      const result = (await resolveTransport({
        queue: "my-queue",
        url,
      })) as unknown as {
        type: string
      }

      expect(result.type).toBe("graphql")
      expect(createGraphQLTransport).toHaveBeenCalledWith(
        url,
        undefined,
        "my-queue"
      )
    })

    it("should resolve queue from config defaultQueue in direct mode", async () => {
      const { loadCliConfig } = await import("../src/config")
      const { createDirectTransport } = await import("../src/transport/direct")
      const mockAdapter = { setQueueName: vi.fn() }
      const mockQueues = [
        { adapter: mockAdapter, name: "email-queue" },
        { adapter: mockAdapter, name: "report-queue" },
      ]

      vi.mocked(loadCliConfig).mockResolvedValue({
        adapter: mockAdapter,
        defaultQueue: "email-queue",
        queues: mockQueues,
      } as never)

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      const result = (await resolveTransport({})) as unknown as {
        type: string
      }

      expect(result.type).toBe("direct")
      expect(createDirectTransport).toHaveBeenCalledWith(
        mockAdapter,
        "email-queue"
      )
    })

    it("should override config default with --queue flag in direct mode", async () => {
      const { loadCliConfig } = await import("../src/config")
      const { createDirectTransport } = await import("../src/transport/direct")
      const mockAdapter = { setQueueName: vi.fn() }
      const mockQueues = [
        { adapter: mockAdapter, name: "email-queue" },
        { adapter: mockAdapter, name: "report-queue" },
      ]

      vi.mocked(loadCliConfig).mockResolvedValue({
        adapter: mockAdapter,
        defaultQueue: "email-queue",
        queues: mockQueues,
      } as never)

      delete process.env.VORSTEH_QUEUE_URL
      delete process.env.VORSTEH_QUEUE_TOKEN

      const result = (await resolveTransport({
        queue: "report-queue",
      })) as unknown as {
        type: string
      }

      expect(result.type).toBe("direct")
      expect(createDirectTransport).toHaveBeenCalledWith(
        mockAdapter,
        "report-queue"
      )
    })
  })
})
