import { PrismaPg } from "@prisma/adapter-pg"

import type { DatabaseConnectionProps } from "@vorsteh-queue/shared-tests/types"
import { runTests } from "@vorsteh-queue/shared-tests/tests/adapter"

import { PrismaClient } from "~/generated/prisma/client"
import { PostgresQueueAdapter } from "../src"
import { prepareTable } from "./helper"

runTests<PrismaClient>(
  {
    initDbClient: (props: DatabaseConnectionProps): PrismaClient => {
      const prismaAdapter = new PrismaPg({ connectionString: props.container.getConnectionUri() })
      return new PrismaClient({ adapter: prismaAdapter })
    },
    initAdapter: (db, dbConfig) => {
      return new PostgresQueueAdapter(db, dbConfig)
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
  },
  [
    {
      modelName: "customQueueJob",
      tableName: "custom_queue_jobs",
      schemaName: "custom_schema",
      useDefault: false,
      description: "custom table and schema",
    },
    { useDefault: true, description: "default table and schema" },
  ],
)
