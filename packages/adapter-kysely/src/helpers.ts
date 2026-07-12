import type { Kysely } from "kysely"
import { sql } from "kysely"

/**
 * Create migration helpers for the queue jobs table.
 *
 * @param tableName - Table name to use
 * @param schemaName - Optional PostgreSQL schema name
 * @returns Object with up/down migration functions
 *
 * @example
 * ```typescript
 * const { up, down } = createQueueJobsTable("queue_jobs")
 * await up(db)
 * ```
 */
export function createQueueJobsTable(tableName: string, schemaName?: string) {
  return {
    down: async (db: Kysely<unknown>) => {
      const schema = schemaName ? db.schema.withSchema(schemaName) : db.schema
      await schema.dropTable(tableName).execute()
      if (schemaName) {
        await schema.dropSchema(schemaName).execute()
      }
    },
    up: async (db: Kysely<unknown>) => {
      await generateUp({ schemaName, tableName, db })
    },
  }
}

async function generateUp({
  schemaName,
  tableName,
  db,
}: {
  schemaName?: string
  tableName: string
  db: Kysely<unknown>
}) {
  if (schemaName) {
    await db.schema.createSchema(schemaName).ifNotExists().execute()
  }

  const schema = schemaName ? db.schema.withSchema(schemaName) : db.schema

  await schema
    .createTable(tableName)
    .addColumn("id", "uuid", (col) =>
      col
        .defaultTo(sql`gen_random_uuid()`)
        .primaryKey()
        .notNull()
    )
    .addColumn("queue_name", "varchar(255)", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("priority", "int4", (col) => col.notNull())
    .addColumn("attempts", "int4", (col) => col.defaultTo(0).notNull())
    .addColumn("max_attempts", "int4", (col) => col.notNull())
    .addColumn("timeout", "int4")
    .addColumn("progress", "int4", (col) => col.defaultTo(0).notNull())
    .addColumn("group_key", "varchar(255)")
    .addColumn("unique_key", "varchar(255)")
    .addColumn("cron", "varchar(255)")
    .addColumn("depends_on", "jsonb")
    .addColumn("on_dependency_failure", "varchar(10)")
    .addColumn("repeat_every", "int4")
    .addColumn("repeat_limit", "int4")
    .addColumn("repeat_count", "int4", (col) => col.defaultTo(0).notNull())
    .addColumn("cancellation_reason", "text")
    .addColumn("error", "jsonb")
    .addColumn("result", "jsonb")
    .addColumn("steps", "jsonb")
    .addColumn("signals", "jsonb")
    .addColumn("parent_id", "uuid")
    .addColumn("flow_id", "uuid")
    .addColumn("children_count", "int4", (col) => col.defaultTo(0).notNull())
    .addColumn("children_completed", "int4", (col) =>
      col.defaultTo(0).notNull()
    )
    .addColumn("fail_parent_on_failure", "int4", (col) =>
      col.defaultTo(0).notNull()
    )
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`timezone('utc'::text, now())`).notNull()
    )
    .addColumn("process_at", "timestamptz", (col) => col.notNull())
    .addColumn("processed_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("cancelled_at", "timestamptz")
    .execute()

  await schema
    .createIndex(`idx_${tableName}_polling`)
    .on(tableName)
    .columns(["queue_name", "status", "priority", "created_at"])
    .execute()

  await schema
    .createIndex(`idx_${tableName}_delayed`)
    .on(tableName)
    .columns(["queue_name", "process_at"])
    .execute()

  await schema
    .createIndex(`idx_${tableName}_active_groups`)
    .on(tableName)
    .columns(["queue_name", "group_key"])
    .execute()

  await schema
    .createIndex(`idx_${tableName}_stats`)
    .on(tableName)
    .columns(["queue_name", "status"])
    .execute()
}
