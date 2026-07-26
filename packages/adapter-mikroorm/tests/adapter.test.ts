import { MikroORM } from "@mikro-orm/postgresql"
import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runFlowAdapterTests } from "@vorsteh-queue/shared-tests/tests/flow-adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"

import { PostgresMikroormQueueAdapter } from "../src/adapter"
import { QueueFlowSchema } from "../src/flow-entity"
import { QueueJobSchema } from "../src/queue-entity"
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

runFlowAdapterTests<MikroORM>({
  initAdapter: (orm, adapterConfig) =>
    new PostgresMikroormQueueAdapter(orm, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): MikroORM =>
    MikroORM.initSync({
      entities: [QueueJobSchema, QueueFlowSchema],
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
