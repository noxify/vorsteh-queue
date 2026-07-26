import type { FlowAdapter, QueueAdapter } from "@vorsteh-queue/core"

import type { initDatabase } from "./database"

export type DatabaseConnectionProps = Awaited<ReturnType<typeof initDatabase>>

export type TestCaseProps =
  | {
      modelName?: string
      tableName: string
      schemaName: string
      description: string
      useDefault: false
    }
  | {
      modelName?: never
      tableName?: never
      schemaName?: never
      description: string
      useDefault: true
    }

export interface SharedTestContext<TDatabase = unknown> {
  initDbClient: (props: DatabaseConnectionProps) => TDatabase
  initAdapter: (
    db: TDatabase,
    adapterConfig?: {
      modelName?: string
      tableName?: string
      schemaName?: string
    }
  ) => Promise<QueueAdapter> | QueueAdapter
  migrate: (db: TDatabase) => Promise<void>
  testCases: TestCaseProps[]
}

export interface FlowAdapterTestContext<TDatabase = unknown> {
  initDbClient: (props: DatabaseConnectionProps) => TDatabase
  initAdapter: (
    db: TDatabase,
    adapterConfig?: {
      modelName?: string
      tableName?: string
      schemaName?: string
      flowModelName?: string
      flowTableName?: string
    }
  ) => Promise<FlowAdapter & QueueAdapter> | (FlowAdapter & QueueAdapter)
  migrate: (db: TDatabase) => Promise<void>
  testCases: TestCaseProps[]
}
