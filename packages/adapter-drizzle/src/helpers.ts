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
  timeout: integer("timeout"),
  progress: integer("progress").default(0).notNull(),
  groupKey: varchar("group_key", { length: 255 }),
  uniqueKey: varchar("unique_key", { length: 255 }),
  cron: varchar("cron", { length: 255 }),
  repeatEvery: integer("repeat_every"),
  repeatLimit: integer("repeat_limit"),
  repeatCount: integer("repeat_count").default(0).notNull(),
  cancellationReason: text("cancellation_reason"),
  error: jsonb("error"),
  result: jsonb("result"),
  steps: jsonb("steps"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`timezone('utc', now())`),
  processAt: timestamp("process_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
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
