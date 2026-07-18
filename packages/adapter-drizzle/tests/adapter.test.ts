// Migration logic is powered by https://github.com/drizzle-team/drizzle-orm/discussions/1901

import { createRequire } from "node:module"

import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { PostgresQueueAdapter } from "../src"
import * as schema from "../src/postgres-test-schema"

global.require = createRequire(import.meta.url)

const { generateDrizzleJson, generateMigration } =
  await import("drizzle-kit/api")

runTests<PostgresJsDatabase<typeof schema>>({
  initAdapter: (db, adapterConfig) =>
    new PostgresQueueAdapter(db, adapterConfig),
  initDbClient: (
    props: DatabaseConnectionProps
  ): PostgresJsDatabase<typeof schema> => {
    const client = postgres(props.container.getConnectionUri(), {
      max: 10, // Connection pool size
    })
    return drizzle(client, { schema })
  },
  migrate: async (db) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const [previous, current] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [{}, schema].map((schemaObject) => generateDrizzleJson(schemaObject))
      )

      const statements = await generateMigration(previous, current)
      const migration = statements.join("\n")

      await db.execute(migration)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", error)
      throw error
    }
  },
  testCases: [
    {
      modelName: "customQueueJobs",
      tableName: "custom_queue_jobs",
      schemaName: "custom_schema",
      useDefault: false,
      description: "custom table and schema",
    },
    { useDefault: true, description: "default table and schema" },
  ],
})

runWhereFilterTests<PostgresJsDatabase<typeof schema>>({
  initAdapter: (db, adapterConfig) =>
    new PostgresQueueAdapter(db, adapterConfig),
  initDbClient: (
    props: DatabaseConnectionProps
  ): PostgresJsDatabase<typeof schema> => {
    const client = postgres(props.container.getConnectionUri(), {
      max: 10,
    })
    return drizzle(client, { schema })
  },
  migrate: async (db) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const [previous, current] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        [{}, schema].map((schemaObject) => generateDrizzleJson(schemaObject))
      )

      const statements = await generateMigration(previous, current)
      const migration = statements.join("\n")

      await db.execute(migration)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", error)
      throw error
    }
  },
  testCases: [
    {
      modelName: "customQueueJobs",
      tableName: "custom_queue_jobs",
      schemaName: "custom_schema",
      useDefault: false,
      description: "custom table and schema",
    },
    { useDefault: true, description: "default table and schema" },
  ],
})
