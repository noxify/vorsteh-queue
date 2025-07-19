import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"

import * as schema from "./schema"

// Shared embedded database connection
const client = new PGlite()

export const db = drizzle(client, { schema })
export { client }