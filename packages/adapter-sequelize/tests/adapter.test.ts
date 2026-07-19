import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { Sequelize } from "sequelize"

import { PostgresSequelizeQueueAdapter } from "../src/postgres-adapter"
import { prepareTable } from "./helper"

runTests<Sequelize>({
  initAdapter: (sequelize, adapterConfig) =>
    new PostgresSequelizeQueueAdapter(sequelize, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): Sequelize =>
    new Sequelize(props.container.getConnectionUri(), {
      logging: false,
      dialect: "postgres",
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

runWhereFilterTests<Sequelize>({
  initAdapter: (sequelize, adapterConfig) =>
    new PostgresSequelizeQueueAdapter(sequelize, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): Sequelize =>
    new Sequelize(props.container.getConnectionUri(), {
      logging: false,
      dialect: "postgres",
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
