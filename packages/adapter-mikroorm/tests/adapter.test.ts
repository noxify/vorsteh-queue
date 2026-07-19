import { MikroORM } from "@mikro-orm/postgresql"
import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"

import { QueueJobSchema } from "../src/entity"
import { PostgresMikroormQueueAdapter } from "../src/postgres-adapter"
import { prepareTable } from "./helper"

runTests<MikroORM>({
  initAdapter: (orm, adapterConfig) =>
    new PostgresMikroormQueueAdapter(orm, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): MikroORM =>
    MikroORM.initSync({
      entities: [QueueJobSchema],
      clientUrl: props.container.getConnectionUri(),
      connect: false,
      allowGlobalContext: true,
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

runWhereFilterTests<MikroORM>({
  initAdapter: (orm, adapterConfig) =>
    new PostgresMikroormQueueAdapter(orm, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): MikroORM =>
    MikroORM.initSync({
      entities: [QueueJobSchema],
      clientUrl: props.container.getConnectionUri(),
      connect: false,
      allowGlobalContext: true,
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
