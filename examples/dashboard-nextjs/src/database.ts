import { mkdirSync } from "node:fs"

import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { drizzle } from "drizzle-orm/pglite"

import { relations } from "./schema"

const PGLITE_PORT = Number(process.env.PGLITE_PORT ?? "5488")
const PGLITE_DATA_DIR = ".vorsteh-queue/data"

// Ensure the data directory exists
mkdirSync(PGLITE_DATA_DIR, { recursive: true })

// File-backed PGlite instance
const client = new PGlite(PGLITE_DATA_DIR)

export const db = drizzle({ client, relations })
export { client }

/**
 * Start the PGlite socket server so external processes (Next.js) can connect
 * via standard PostgreSQL protocol.
 */
export async function startSocketServer(): Promise<PGLiteSocketServer> {
  const server = new PGLiteSocketServer({
    db: client,
    port: PGLITE_PORT,
    host: "127.0.0.1",
  })

  await server.start()
  console.log(`PGlite socket server listening on 127.0.0.1:${PGLITE_PORT}`)
  return server
}
