import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runFlowAdapterTests } from "@vorsteh-queue/shared-tests/tests/flow-adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { DataSource } from "typeorm"

import { PostgresTypeormQueueAdapter } from "../src/adapter"
import { QueueFlowEntity } from "../src/flow-entity"
import { QueueJobEntity } from "../src/queue-entity"
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

runFlowAdapterTests<DataSource>({
  initAdapter: (dataSource, adapterConfig) =>
    new PostgresTypeormQueueAdapter(dataSource, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): DataSource =>
    new DataSource({
      type: "postgres",
      url: props.container.getConnectionUri(),
      entities: [QueueJobEntity, QueueFlowEntity],
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
