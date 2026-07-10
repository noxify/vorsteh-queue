import consola from "consola"
import * as fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Extracted error boundary logic from bin.ts for testability.
 * This replicates the exact error handling pattern used in the CLI entry point.
 */
function handleError(error: unknown, debug: string | undefined): void {
  if (error instanceof Error) {
    consola.error(`\nError: ${error.message}`)
    if (debug) {
      consola.error(error)
    }
  } else {
    consola.error("\nAn unknown error occurred.")
    if (debug) {
      consola.error(error)
    }
  }

  process.exitCode = 1
}

describe("error-boundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>
  let originalDebug: string | undefined

  beforeEach(() => {
    errorSpy = vi.spyOn(consola, "error").mockImplementation(() => {})
    originalDebug = process.env.DEBUG
    delete process.env.DEBUG
    process.exitCode = undefined as unknown as number
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalDebug !== undefined) {
      process.env.DEBUG = originalDebug
    } else {
      delete process.env.DEBUG
    }
    process.exitCode = undefined as unknown as number
  })

  // Feature: cli-remote-transport, Property 13: Error boundary formats messages without stack traces
  describe("Property 13: Error boundary formats messages without stack traces", () => {
    /**
     * **Validates: Requirements 6.3**
     *
     * For any Error instance caught by the error boundary when DEBUG is not set,
     * the CLI SHALL output the error message in the format `\nError: <message>`
     * to stderr and SHALL NOT include a stack trace.
     */
    it("should format Error messages as '\\nError: <message>' without stack trace when DEBUG is unset", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (message) => {
          errorSpy.mockClear()
          process.exitCode = undefined as unknown as number

          const error = new Error(message)
          handleError(error, undefined)

          expect(errorSpy).toHaveBeenCalledTimes(1)
          expect(errorSpy).toHaveBeenCalledWith(`\nError: ${message}`)
          expect(process.exitCode).toBe(1)
        }),
        { numRuns: 100 }
      )
    })

    it("should never pass the Error object itself when DEBUG is not set", () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (message) => {
          errorSpy.mockClear()

          const error = new Error(message)
          handleError(error, undefined)

          // Ensure the full error object (with stack) was NOT passed
          for (const call of errorSpy.mock.calls) {
            expect(call[0]).not.toBe(error)
          }
        }),
        { numRuns: 100 }
      )
    })
  })

  // Feature: cli-remote-transport, Property 14: Debug mode includes full error output
  describe("Property 14: Debug mode includes full error output", () => {
    /**
     * **Validates: Requirements 6.5**
     *
     * For any Error instance caught by the error boundary when the DEBUG
     * environment variable is set to a non-empty value, the CLI SHALL output
     * both the formatted message and the full error (including stack trace)
     * to stderr.
     */
    it("should output both formatted message and full error object when DEBUG is set", () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (message, debugValue) => {
            errorSpy.mockClear()
            process.exitCode = undefined as unknown as number

            const error = new Error(message)
            handleError(error, debugValue)

            expect(errorSpy).toHaveBeenCalledTimes(2)
            expect(errorSpy).toHaveBeenNthCalledWith(1, `\nError: ${message}`)
            expect(errorSpy).toHaveBeenNthCalledWith(2, error)
            expect(process.exitCode).toBe(1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should output full non-Error value when DEBUG is set", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined),
            fc.dictionary(fc.string(), fc.string())
          ),
          fc.string({ minLength: 1 }),
          (value, debugValue) => {
            // Skip if value is an Error instance (covered by the Error path)
            if (value instanceof Error) return

            errorSpy.mockClear()
            process.exitCode = undefined as unknown as number

            handleError(value, debugValue)

            expect(errorSpy).toHaveBeenCalledTimes(2)
            expect(errorSpy).toHaveBeenNthCalledWith(
              1,
              "\nAn unknown error occurred."
            )
            expect(errorSpy).toHaveBeenNthCalledWith(2, value)
            expect(process.exitCode).toBe(1)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Example test: non-Error value produces "unknown error" message (Req 6.4)
  describe("non-Error values", () => {
    /**
     * **Validates: Requirements 6.4, 7.12**
     */
    it("should print 'An unknown error occurred.' for string thrown value", () => {
      handleError("something went wrong", undefined)

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith("\nAn unknown error occurred.")
      expect(process.exitCode).toBe(1)
    })

    it("should print 'An unknown error occurred.' for null thrown value", () => {
      handleError(null, undefined)

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith("\nAn unknown error occurred.")
      expect(process.exitCode).toBe(1)
    })

    it("should print 'An unknown error occurred.' for number thrown value", () => {
      handleError(42, undefined)

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith("\nAn unknown error occurred.")
      expect(process.exitCode).toBe(1)
    })

    it("should print 'An unknown error occurred.' for object thrown value", () => {
      handleError({ code: "FAIL" }, undefined)

      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith("\nAn unknown error occurred.")
      expect(process.exitCode).toBe(1)
    })
  })

  // Validates: Requirements 7.13
  describe("exitCode is always set to 1", () => {
    it("should set process.exitCode to 1 for Error instances", () => {
      handleError(new Error("test"), undefined)
      expect(process.exitCode).toBe(1)
    })

    it("should set process.exitCode to 1 for non-Error values", () => {
      handleError("string error", undefined)
      expect(process.exitCode).toBe(1)
    })
  })
})
