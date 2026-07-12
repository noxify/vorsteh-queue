import type {
  ColumnType,
  Insertable,
  InsertObject,
  Selectable,
  Updateable,
} from "kysely"

type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>
type Timestamp = ColumnType<Date, Date | string, Date | string>

export interface QueueJobTableDefinition {
  id: Generated<string>
  queue_name: string
  name: string
  payload: unknown
  status: string
  priority: number
  attempts: Generated<number>
  max_attempts: number
  timeout: number | null
  progress: Generated<number>
  group_key: string | null
  unique_key: string | null
  cron: string | null
  depends_on: unknown
  repeat_every: number | null
  repeat_limit: number | null
  repeat_count: Generated<number>
  cancellation_reason: string | null
  error: unknown
  result: unknown
  steps: unknown
  signals: unknown
  on_dependency_failure: string | null
  parent_id: string | null
  flow_id: string | null
  children_count: Generated<number>
  children_completed: Generated<number>
  fail_parent_on_failure: Generated<number>
  created_at: Generated<Timestamp>
  process_at: Timestamp
  processed_at: Timestamp | null
  completed_at: Timestamp | null
  failed_at: Timestamp | null
  cancelled_at: Timestamp | null
}

export type QueueJob = Selectable<QueueJobTableDefinition>
export type NewQueueJob = Insertable<QueueJobTableDefinition>
export type QueueJobUpdate = Updateable<QueueJobTableDefinition>

export interface DB {
  tablename: QueueJobTableDefinition
}

export type InsertQueueJobValue = InsertObject<DB, "tablename">
