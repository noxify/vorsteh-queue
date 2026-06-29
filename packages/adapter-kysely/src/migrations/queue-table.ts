import type { Kysely } from "kysely"
import { sql } from "kysely"

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("queue_jobs")
    .addColumn("id", "uuid", (col) =>
      col.defaultTo(sql`gen_random_uuid()`).notNull()
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
    .addColumn("repeat_every", "int4")
    .addColumn("repeat_limit", "int4")
    .addColumn("repeat_count", "int4", (col) => col.defaultTo(0).notNull())
    .addColumn("cancellation_reason", "text")
    .addColumn("error", "jsonb")
    .addColumn("result", "jsonb")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`timezone('utc'::text, now())`).notNull()
    )
    .addColumn("process_at", "timestamptz", (col) => col.notNull())
    .addColumn("processed_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("cancelled_at", "timestamptz")
    .execute()

  await db.schema
    .createIndex("idx_queue_jobs_polling")
    .on("queue_jobs")
    .columns(["queue_name", "status", "priority", "created_at"])
    .execute()

  await db.schema
    .createIndex("idx_queue_jobs_delayed")
    .on("queue_jobs")
    .columns(["queue_name", "process_at"])
    .execute()

  await db.schema
    .createIndex("idx_queue_jobs_active_groups")
    .on("queue_jobs")
    .columns(["queue_name", "group_key"])
    .execute()

  await db.schema
    .createIndex("idx_queue_jobs_stats")
    .on("queue_jobs")
    .columns(["queue_name", "status"])
    .execute()
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("queue_jobs").execute()
}
