/**
 * Queue configuration for the dashboard example (direct mode).
 *
 * Loaded by c12 when QUEUE_MODE=direct (default).
 * Uses the Drizzle adapter with a PostgreSQL connection.
 *
 * For a zero-setup demo, swap the db connection for PGlite:
 *   import { PGlite } from "@electric-sql/pglite"
 *   import { drizzle } from "drizzle-orm/pglite"
 *   const db = drizzle({ client: new PGlite() })
 */

import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { drizzle } from "drizzle-orm/node-postgres"

const db = drizzle(
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/vorsteh-queue"
)

const adapter = new PostgresQueueAdapter(db)

export default {
  adapter,
}
