import type { BaseQueueAdapter } from "@vorsteh-queue/core"

import type { initDatabase } from "./database"

// Zentrale Typdefinition für Adapter-Factories
export type AdapterFactory = () => Promise<unknown>

export type DatabaseConnectionProps = Awaited<ReturnType<typeof initDatabase>>

export interface SharedTestContext<TDatabase = unknown> {
  initDbClient: (props: DatabaseConnectionProps) => TDatabase
  initAdapter: (db: TDatabase) => Promise<BaseQueueAdapter> | BaseQueueAdapter
  migrate: (db: TDatabase) => Promise<void>
}
