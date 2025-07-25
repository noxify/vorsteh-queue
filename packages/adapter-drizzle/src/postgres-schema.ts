import { sql } from "drizzle-orm"
import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

export const queueJobs = pgTable(
  "queue_jobs",
  {
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
  },
  (table) => [
    index("idx_queue_jobs_status_priority").on(
      table.queueName,
      table.status,
      table.priority,
      table.createdAt,
    ),
    index("idx_queue_jobs_process_at").on(table.processAt),
  ],
)

export type QueueJob = typeof queueJobs.$inferSelect
export type InsertQueueJob = typeof queueJobs.$inferInsert
