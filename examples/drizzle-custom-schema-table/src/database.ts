import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "./schema"

// Shared database connection
const client = postgres(
  process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/queue_db",
  { max: 10 }, // Connection pool
)

export const db = drizzle(client, { schema })
export { client }
