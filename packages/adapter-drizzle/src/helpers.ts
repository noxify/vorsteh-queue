import { sql } from "drizzle-orm"
import {
  index,
  integer,
  isPgSchema,
  jsonb,
  pgSchema,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const columns = {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  queueName: varchar("queue_name", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  priority: integer("priority").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`timezone('utc', now())`),
  processAt: timestamp("process_at", { withTimezone: true, mode: "date" }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
  error: jsonb("error"),
  result: jsonb("result"),
  progress: integer("progress").default(0),
  cron: varchar("cron", { length: 255 }),
  repeatEvery: integer("repeat_every"),
  repeatLimit: integer("repeat_limit"),
  repeatCount: integer("repeat_count").default(0),
  timeout: jsonb("timeout"),
}

export const createQueueJobsTable = (tableName: string, schemaName?: string) => {
  const schema = schemaName ? pgSchema(schemaName) : undefined

  if (isPgSchema(schema)) {
    return schema.table(tableName, columns, (table) => [
      index(`idx_${tableName}_status_priority`).on(
        table.queueName,
        table.status,
        table.priority,
        table.createdAt,
      ),
      index(`idx_${tableName}_process_at`).on(table.processAt),
    ])
  } else {
    return pgTable(tableName, columns, (table) => [
      index(`idx_${tableName}_status_priority`).on(
        table.queueName,
        table.status,
        table.priority,
        table.createdAt,
      ),
      index(`idx_${tableName}_process_at`).on(table.processAt),
    ])
  }
}
