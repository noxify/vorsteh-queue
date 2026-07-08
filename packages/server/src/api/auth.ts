/**
 * Authentication middleware factory.
 *
 * Supports token-based auth, custom middleware, and no-auth mode.
 */

import type { MiddlewareHandler } from "hono"

import type { AuthConfig } from "../config"

/**
 * Create authentication middleware based on config.
 *
 * @param config - Auth configuration
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * const auth = createAuthMiddleware({ tokens: ["sk_live_abc"] })
 * app.use("/graphql", auth)
 * ```
 */
export function createAuthMiddleware(config: AuthConfig): MiddlewareHandler {
  if (config === false) {
    // eslint-disable-next-line no-console
    console.warn("\u26A0 vorsteh-queue server running without authentication.")
    return async (_c, next) => next()
  }

  if ("middleware" in config) {
    return config.middleware
  }

  // Token-based auth
  const validTokens = new Set(config.tokens)

  return async (c, next) => {
    // Allow GraphiQL UI to load without auth (browser GET requesting HTML)
    if (
      c.req.method === "GET" &&
      c.req.header("Accept")?.includes("text/html")
    ) {
      return next()
    }

    const header = c.req.header("Authorization")
    if (!header?.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401)
    }

    const token = header.slice(7)
    if (!validTokens.has(token)) {
      return c.json({ error: "Invalid token" }, 401)
    }

    return next()
  }
}
