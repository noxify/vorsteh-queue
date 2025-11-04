import type { Kysely } from "kysely"
import { sql } from "kysely"

export async function up(db: Kysely<unknown>) {
  await db.schema.createSchema("custom_schema").ifNotExists().execute()

  await db.schema
    .withSchema("custom_schema")
    .createTable("custom_queue_jobs")
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

  await db.schema
    .withSchema("custom_schema")
    .createIndex("idx_custom_queue_jobs_status_priority")
    .on("custom_queue_jobs")
    .columns(["queue_name", "status", "priority", "created_at"])
    .execute()

  await db.schema
    .withSchema("custom_schema")
    .createIndex("idx_custom_queue_jobs_process_at")
    .on("custom_queue_jobs")
    .column("process_at")
    .execute()
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropSchema("custom_schema").execute()
  await db.schema.withSchema("custom_schema").dropTable("custom_queue_jobs").execute()
}
