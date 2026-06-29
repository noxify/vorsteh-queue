/**
 * Authentication middleware factory.
 *
 * Supports token auth, basic auth, custom middleware, and no-auth mode.
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
 * const auth = createAuthMiddleware({ type: "token", token: "secret" })
 * app.use("/queue/*", auth)
 * ```
 */
export function createAuthMiddleware(config: AuthConfig): MiddlewareHandler {
  if (config === false) {
    // eslint-disable-next-line no-console
    console.warn("⚠ vorsteh-queue server running without authentication.")
    return async (_c, next) => next()
  }

  switch (config.type) {
    case "token": {
      return async (c, next) => {
        const header = c.req.header("Authorization")
        if (header !== `Bearer ${config.token}`) {
          return c.json({ error: "Unauthorized" }, 401)
        }
        return next()
      }
    }

    case "basic": {
      return async (c, next) => {
        const header = c.req.header("Authorization")
        if (!header?.startsWith("Basic ")) {
          c.header("WWW-Authenticate", 'Basic realm="vorsteh-queue"')
          return c.json({ error: "Unauthorized" }, 401)
        }

        const decoded = atob(header.slice(6))
        const [username, password] = decoded.split(":")

        if (username !== config.username || password !== config.password) {
          return c.json({ error: "Invalid credentials" }, 401)
        }

        return next()
      }
    }

    // eslint-disable-next-line default-case-last
    default: {
      return config.middleware
    }
  }
}
