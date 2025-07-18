import { sql } from "drizzle-orm"
import { index, int, json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core"

export const queueJobs = mysqlTable(
  "queue_jobs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`(UUID())`),
    queueName: varchar("queue_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    payload: json("payload").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    priority: int("priority").notNull(),
    attempts: int("attempts").default(0).notNull(),
    maxAttempts: int("max_attempts").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    processAt: timestamp("process_at").notNull(),
    processedAt: timestamp("processed_at"),
    completedAt: timestamp("completed_at"),
    failedAt: timestamp("failed_at"),
    error: json("error"),
    progress: int("progress").default(0),
    cron: varchar("cron", { length: 255 }),
    repeatEvery: int("repeat_every"),
    repeatLimit: int("repeat_limit"),
    repeatCount: int("repeat_count").default(0),
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
