// Migration logic is powered by https://github.com/drizzle-team/drizzle-orm/discussions/1901

import { createRequire } from "module"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { runProgressTests } from "@vorsteh-queue/shared-tests/progressTests"

import { PostgresQueueAdapter } from "../src"
import * as schema from "../src/postgres-schema"

global.require = createRequire(import.meta.url)

const { generateDrizzleJson, generateMigration } = await import("drizzle-kit/api")

runProgressTests<PostgresJsDatabase<typeof schema>>({
  initDbClient: (props: DatabaseConnectionProps): PostgresJsDatabase<typeof schema> => {
    const client = postgres(props.container.getConnectionUri(), {
      max: 10, // Connection pool size
    })
    return drizzle(client, { schema })
  },
  initAdapter: (db) => {
    return new PostgresQueueAdapter(db)
  },
  migrate: async (db) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const [previous, current] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [{}, schema].map((schemaObject) => generateDrizzleJson(schemaObject)),
      )

      const statements = await generateMigration(previous, current)
      const migration = statements.join("\n")

      await db.execute(migration)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", err)
      throw err
    }
  },
})
