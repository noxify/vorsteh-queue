import { PrismaPg } from "@prisma/adapter-pg"

import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { runTests } from "@vorsteh-queue/shared-tests/tests/progress"

import { PrismaClient } from "~/generated/prisma/client"
import { PostgresQueueAdapter } from "../src"
import { prepareTable } from "./helper"

runTests<PrismaClient>({
  initDbClient: (props: DatabaseConnectionProps): PrismaClient => {
    const prismaAdapter = new PrismaPg({ connectionString: props.container.getConnectionUri() })
    return new PrismaClient({ adapter: prismaAdapter })
  },
  initAdapter: (db) => {
    return new PostgresQueueAdapter(db)
  },
  migrate: async () => {
    try {
      await prepareTable()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Migration error:", err)
      throw err
    }
  },
  testCases: [{ useDefault: true, description: "default table and schema" }],
})
