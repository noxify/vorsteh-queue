// License: MIT
// Author: Olivier Louvignes - https://github.com/mgcrea
// Source: https://github.com/mgcrea/prisma-queue/blob/master/src/utils/error.ts

import type { SerializedError } from "../../types"

/**
 * Serializes an error object for storage in the database.
 * Handles both Error instances and unknown error types.
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
