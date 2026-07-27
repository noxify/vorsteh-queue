import { ZenStackClient } from "@zenstackhq/orm"
import { PostgresDialect } from "@zenstackhq/orm/dialects/postgres"
import { Pool } from "pg"

import { schema } from "../zenstack/schema"

export const db = new ZenStackClient(schema, {
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  }),
})
