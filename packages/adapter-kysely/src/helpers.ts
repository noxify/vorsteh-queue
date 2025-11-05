import type { Kysely } from "kysely"
import { sql } from "kysely"

export function createQueueJobsTable(tableName: string, schemaName?: string) {
  return {
    up: async (db: Kysely<unknown>) => {
      await generateUp({ schemaName, tableName, db })
    },
    down: async (db: Kysely<unknown>) => {
      const schema = schemaName ? db.schema.withSchema(schemaName) : db.schema
      await schema.dropTable(tableName).execute()
      if (schemaName) {
        await schema.dropSchema(schemaName).execute()
      }
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
    await db.schema.createSchema("custom_schema").ifNotExists().execute()
  }

  const schema = schemaName ? db.schema.withSchema(schemaName) : db.schema

  await schema
    .createTable(tableName)
    .addColumn("id", "uuid", (col) => col.defaultTo(sql`gen_random_uuid()`).notNull())
    .addColumn("queue_name", "varchar(255)", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("priority", "int4", (col) => col.notNull())
    .addColumn("attempts", "int4", (col) => col.defaultTo(0).notNull())
    .addColumn("max_attempts", "int4", (col) => col.notNull())
    .addColumn("timeout", "jsonb")
    .addColumn("cron", "varchar(255)")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`timezone('utc'::text, now())`).notNull(),
    )
    .addColumn("process_at", "timestamptz", (col) => col.notNull())
    .addColumn("processed_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("error", "jsonb")
    .addColumn("result", "jsonb")
    .addColumn("progress", "int4")
    .addColumn("repeat_every", "int4")
    .addColumn("repeat_limit", "int4")
    .addColumn("repeat_count", "int4")
    .execute()

  await schema
    .createIndex(`idx_${tableName}_status_priority`)
    .on(tableName)
    .columns(["queue_name", "status", "priority", "created_at"])
    .execute()

  await schema
    .createIndex(`idx_${tableName}_process_at`)
    .on(tableName)
    .column("process_at")
    .execute()
}
