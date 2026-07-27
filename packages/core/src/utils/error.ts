import type { SerializedError } from "../types"

/**
 * Serializes an error object for storage in the database.
 * Handles both Error instances and unknown error types.
 *
 * @param err - Error to serialize (supports Error instances and unknown types)
 * @returns Serialized error with name, message, and optional stack trace
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation()
 * } catch (err) {
 *   const serialized = serializeError(err)
 *   // { name: "TypeError", message: "...", stack: "..." }
 * }
 * ```
 */
export const serializeError = (err: unknown): SerializedError => {
  if (err instanceof Error) {
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
    }
  }
  return {
    message: String(err),
    name: "UnknownError",
    stack: undefined,
  }
}
