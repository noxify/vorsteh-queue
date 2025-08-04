import { Kysely } from "kysely"
import { PostgresJSDialect } from "kysely-postgres-js"
import postgres from "postgres"

import type { QueueJobTableDefinition } from "@vorsteh-queue/adapter-kysely/types"

interface DB {
  queue_jobs: QueueJobTableDefinition
}

// Shared database connection
const client = postgres(
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/queue_db",
  { max: 10 }, // Connection pool
)

const db = new Kysely<DB>({
  dialect: new PostgresJSDialect({
    postgres: client,
  }),
})

export { client, db }
