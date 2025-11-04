import type { QueueAdapter } from "@vorsteh-queue/core"

import type { initDatabase } from "./database"

// Zentrale Typdefinition für Adapter-Factories
export type AdapterFactory = () => Promise<unknown>

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
    adapterConfig?: { modelName?: string; tableName?: string; schemaName?: string },
  ) => Promise<QueueAdapter> | QueueAdapter
  migrate: (db: TDatabase) => Promise<void>
  testCases: TestCaseProps[]
}
