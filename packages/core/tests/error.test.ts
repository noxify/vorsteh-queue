import { describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import { Queue } from "../src/core/queue"
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

describe("Queue handler registration", () => {
  it("should throw if registering the same single handler name twice", () => {
    const queue = new Queue(new MemoryQueueAdapter(), { name: "unique-test" })
    queue.register("foo", () => Promise.resolve())
    expect(() => queue.register("foo", () => Promise.resolve())).toThrowError(/already registered/)
  })

  it("should throw if registering the same batch handler name twice", () => {
    const queue = new Queue(new MemoryQueueAdapter(), { name: "unique-test" })
    queue.registerBatch("bar", () => Promise.resolve([]))
    expect(() => queue.registerBatch("bar", () => Promise.resolve([]))).toThrowError(
      /already registered/,
    )
  })
  it("should throw if registering both single and batch handler for the same job name", () => {
    const queue = new Queue(new MemoryQueueAdapter(), { name: "exclusive-test" })
    queue.register("foo", () => Promise.resolve())
    expect(() => queue.registerBatch("foo", () => Promise.resolve([]))).toThrowError(
      /already registered/,
    )
  })

  it("should throw if registering both batch and single handler for the same job name (reverse order)", () => {
    const queue = new Queue(new MemoryQueueAdapter(), { name: "exclusive-test" })
    queue.registerBatch("bar", () => Promise.resolve([]))
    expect(() => queue.register("bar", () => Promise.resolve())).toThrowError(/already registered/)
  })
})
