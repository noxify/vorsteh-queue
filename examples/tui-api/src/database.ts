import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

import { relations } from "./schema"

// In-memory PGlite — no files on disk, starts fresh every run
const client = new PGlite()

export const db = drizzle({ client, relations })
export { client }
