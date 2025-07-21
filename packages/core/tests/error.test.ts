import { describe, expect, it } from "vitest"

import { serializeError } from "../src/utils/error"

describe("serializeError", () => {
  it("should serialize Error instances correctly", () => {
    const error = new Error("Test error message")
    error.stack = "Error: Test error message\n    at test.js:1:1"

    const result = serializeError(error)

    expect(result).toEqual({
      name: "Error",
      message: "Test error message",
      stack: "Error: Test error message\n    at test.js:1:1",
    })
  })

  it("should serialize custom Error types", () => {
    const error = new TypeError("Type error message")
    const result = serializeError(error)

    expect(result).toEqual({
      name: "TypeError",
      message: "Type error message",
      stack: error.stack,
    })
  })

  it("should handle unknown error types", () => {
    const result = serializeError("String error")

    expect(result).toEqual({
      name: "UnknownError",
      message: "String error",
      stack: undefined,
    })
  })

  it("should handle null/undefined errors", () => {
    expect(serializeError(null)).toEqual({
      name: "UnknownError",
      message: "null",
      stack: undefined,
    })

    expect(serializeError(undefined)).toEqual({
      name: "UnknownError",
      message: "undefined",
      stack: undefined,
    })
  })

  it("should handle object errors", () => {
    const result = serializeError({ code: 500, message: "Server error" })

    expect(result).toEqual({
      name: "UnknownError",
      message: "[object Object]",
      stack: undefined,
    })
  })
})
