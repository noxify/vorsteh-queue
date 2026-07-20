import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

import { relations } from "./schema"

// In-memory PGlite — everything runs in one process
const client = new PGlite()

export const db = drizzle({ client, relations })
export { client }
