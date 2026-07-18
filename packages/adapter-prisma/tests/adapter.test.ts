import { PrismaPg } from "@prisma/adapter-pg"
import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"
import { runWhereFilterTests } from "@vorsteh-queue/shared-tests/tests/where-filter"
import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"

import { PrismaClient } from "~/generated/prisma/client"

import { PostgresQueueAdapter } from "../src"
import { prepareTable } from "./helper"

runTests<PrismaClient>({
  initAdapter: (db, adapterConfig) =>
    new PostgresQueueAdapter(db, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): PrismaClient => {
    const prismaAdapter = new PrismaPg({
      connectionString: props.container.getConnectionUri(),
    })
    return new PrismaClient({ adapter: prismaAdapter })
  },
  migrate: async () => {
    try {
      await prepareTable()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", error)
      throw error
    }
  },
  testCases: [{ useDefault: true, description: "default table and schema" }],
})

runWhereFilterTests<PrismaClient>({
  initAdapter: (db, adapterConfig) =>
    new PostgresQueueAdapter(db, adapterConfig),
  initDbClient: (props: DatabaseConnectionProps): PrismaClient => {
    const prismaAdapter = new PrismaPg({
      connectionString: props.container.getConnectionUri(),
    })
    return new PrismaClient({ adapter: prismaAdapter })
  },
  migrate: async () => {
    try {
      await prepareTable()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", error)
      throw error
    }
  },
  testCases: [{ useDefault: true, description: "default table and schema" }],
})
