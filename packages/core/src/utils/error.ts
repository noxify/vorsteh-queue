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
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }
  return {
    name: "UnknownError",
    message: String(err),
    stack: undefined,
  }
}
