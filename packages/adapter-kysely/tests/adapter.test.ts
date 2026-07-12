import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { Kysely } from "kysely"
import { PostgresJSDialect } from "kysely-postgres-js"
import postgres from "postgres"

import type { DB } from "~/types"

import { PostgresQueueAdapter } from "../src"
import { createQueueJobsTable } from "../src/helpers"

runTests<Kysely<DB>>({
  initAdapter: (db, adapterConfig) =>
    new PostgresQueueAdapter(db, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): Kysely<DB> =>
    new Kysely<DB>({
      dialect: new PostgresJSDialect({
        postgres: postgres(props.container.getConnectionUri(), { max: 10 }),
      }),
    }),
  migrate: async (db) => {
    try {
      // Default table
      const defaultMigration = createQueueJobsTable("queue_jobs")
      await defaultMigration.up(db as Kysely<unknown>)

      // Custom table for custom schema test case
      const customMigration = createQueueJobsTable(
        "custom_queue_jobs",
        "custom_schema"
      )
      await customMigration.up(db as Kysely<unknown>)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", error)
      throw error
    }
  },
  testCases: [
    {
      useDefault: false,
      description: "custom schema and tablename",
      tableName: "custom_queue_jobs",
      schemaName: "custom_schema",
    },
    { useDefault: true, description: "default table and schema" },
  ],
})
