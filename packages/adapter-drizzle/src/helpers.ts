import { sql } from "drizzle-orm"
import {
  index,
  integer,
  isPgSchema,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const columns = {
  attempts: integer("attempts").default(0).notNull(),
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`timezone('utc', now())`),
  cron: varchar("cron", { length: 255 }),
  error: jsonb("error"),
  failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
  groupKey: varchar("group_key", { length: 255 }),
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  maxAttempts: integer("max_attempts").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  payload: jsonb("payload").notNull(),
  priority: integer("priority").notNull(),
  processAt: timestamp("process_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  progress: integer("progress").default(0).notNull(),
  queueName: varchar("queue_name", { length: 255 }).notNull(),
  repeatCount: integer("repeat_count").default(0).notNull(),
  repeatEvery: integer("repeat_every"),
  repeatLimit: integer("repeat_limit"),
  result: jsonb("result"),
  status: varchar("status", { length: 50 }).notNull(),
  steps: jsonb("steps"),
  timeout: integer("timeout"),
  uniqueKey: varchar("unique_key", { length: 255 }),
}

/**
 * Create a custom queue jobs table with optional schema support.
 *
 * @param tableName - Table name to use
 * @param schemaName - Optional PostgreSQL schema name
 * @returns Object with schema and table definitions
 *
 * @example
 * ```typescript
 * const { table } = createQueueJobsTable("my_jobs")
 * const { schema, table } = createQueueJobsTable("jobs", "custom_schema")
 * ```
 */
export const createQueueJobsTable = (
  tableName: string,
  schemaName?: string
) => {
  const schema = schemaName ? pgSchema(schemaName) : undefined

  if (isPgSchema(schema)) {
    return {
      schema,
      table: schema.table(tableName, columns, (table) => [
        index(`idx_${tableName}_polling`).on(
          table.queueName,
          table.status,
          table.priority,
          table.createdAt
        ),
        index(`idx_${tableName}_delayed`).on(table.queueName, table.processAt),
        index(`idx_${tableName}_active_groups`).on(
          table.queueName,
          table.groupKey
        ),
        index(`idx_${tableName}_stats`).on(table.queueName, table.status),
      ]),
    }
  }

  return {
    schema: undefined,
    table: pgTable(tableName, columns, (table) => [
      index(`idx_${tableName}_polling`).on(
        table.queueName,
        table.status,
        table.priority,
        table.createdAt
      ),
      index(`idx_${tableName}_delayed`).on(table.queueName, table.processAt),
      index(`idx_${tableName}_active_groups`).on(
        table.queueName,
        table.groupKey
      ),
      index(`idx_${tableName}_stats`).on(table.queueName, table.status),
    ]),
  }
}
