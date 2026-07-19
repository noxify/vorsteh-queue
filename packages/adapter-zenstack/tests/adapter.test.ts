import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"

import { PostgresZenstackQueueAdapter } from "../src"
import { prepareTable } from "./helper"
import type { MockZenStackClient } from "./mock-client"
import { createMockZenStackClient } from "./mock-client"

runTests<MockZenStackClient>({
  initAdapter: (db, adapterConfig) =>
    new PostgresZenstackQueueAdapter(db as never, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): MockZenStackClient =>
    createMockZenStackClient(props.container.getConnectionUri()),
  migrate: async () => {
    try {
      const databaseUrl =
        // eslint-disable-next-line no-restricted-properties
        process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is not set")
      }
      await prepareTable(databaseUrl)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", error)
      throw error
    }
  },
  testCases: [{ useDefault: true, description: "default table and schema" }],
})

runWhereFilterTests<MockZenStackClient>({
  initAdapter: (db, adapterConfig) =>
    new PostgresZenstackQueueAdapter(db as never, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): MockZenStackClient =>
    createMockZenStackClient(props.container.getConnectionUri()),
  migrate: async () => {
    try {
      const databaseUrl =
        // eslint-disable-next-line no-restricted-properties
        process.env.DATABASE_URL
      if (!databaseUrl) {
        throw new Error("DATABASE_URL environment variable is not set")
      }
      await prepareTable(databaseUrl)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", error)
      throw error
    }
  },
  testCases: [{ useDefault: true, description: "default table and schema" }],
})
