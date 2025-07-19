import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema"

// Shared database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/queue_db",
  max: 10 // Connection pool size
})

export const db = drizzle(pool, { schema })
export { pool }