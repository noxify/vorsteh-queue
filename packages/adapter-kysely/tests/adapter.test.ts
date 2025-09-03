import path from "path"
import { Kysely, Migrator } from "kysely"
import { TSFileMigrationProvider } from "kysely-ctl"
import { PostgresJSDialect } from "kysely-postgres-js"
import postgres from "postgres"

import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"

import type { DB } from "~/types"
import { PostgresQueueAdapter } from "../src"

runTests<Kysely<DB>>({
  initDbClient: (props: DatabaseConnectionProps): Kysely<DB> => {
    const db = new Kysely<DB>({
      dialect: new PostgresJSDialect({
        postgres: postgres(props.container.getConnectionUri(), {
          max: 10, // Connection pool size
        }),
      }),
    })

    return db
  },
  initAdapter: (db) => {
    return new PostgresQueueAdapter(db)
  },
  migrate: async (db) => {
    try {
      const migrator = new Migrator({
        db,
        provider: new TSFileMigrationProvider({
          // This needs to be an absolute path.
          migrationFolder: path.join(__dirname, "../src/migrations"),
        }),
      })

      await migrator.migrateToLatest()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", err)
      throw err
    }
  },
})
