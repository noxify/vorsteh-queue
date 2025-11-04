import type { ColumnType, Insertable, InsertObject, Selectable, Updateable } from "kysely"

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
  created_at: Generated<Timestamp>
  process_at: Timestamp
  processed_at: Timestamp | null
  completed_at: Timestamp | null
  failed_at: Timestamp | null
  error: unknown
  result: unknown
  progress: Generated<number | null>
  timeout: number | false | null
  cron: string | null
  repeat_every: number | null
  repeat_limit: number | null
  repeat_count: Generated<number | null>
}

export type QueueJob = Selectable<QueueJobTableDefinition>
export type NewQueueJob = Insertable<QueueJobTableDefinition>
export type QueueJobUpdate = Updateable<QueueJobTableDefinition>

export interface DB {
  tablename: QueueJobTableDefinition
}

export type InsertQueueJobValue = InsertObject<DB, "tablename">
