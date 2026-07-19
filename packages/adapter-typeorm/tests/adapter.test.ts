import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { DataSource } from "typeorm"

import { QueueJobEntity } from "../src/entity"
import { PostgresTypeormQueueAdapter } from "../src/postgres-adapter"
import { prepareTable } from "./helper"

runTests<DataSource>({
  initAdapter: (dataSource, adapterConfig) =>
    new PostgresTypeormQueueAdapter(dataSource, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): DataSource =>
    new DataSource({
      type: "postgres",
      url: props.container.getConnectionUri(),
      entities: [QueueJobEntity],
      synchronize: false,
      logging: false,
    }),
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

runWhereFilterTests<DataSource>({
  initAdapter: (dataSource, adapterConfig) =>
    new PostgresTypeormQueueAdapter(dataSource, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): DataSource =>
    new DataSource({
      type: "postgres",
      url: props.container.getConnectionUri(),
      entities: [QueueJobEntity],
      synchronize: false,
      logging: false,
    }),
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
