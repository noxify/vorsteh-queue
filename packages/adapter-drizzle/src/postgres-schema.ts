import { sql } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

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
    signals: jsonb("signals"),
    parentId: uuid("parent_id"),
    flowId: uuid("flow_id"),
    childrenCount: integer("children_count").default(0).notNull(),
    childrenCompleted: integer("children_completed").default(0).notNull(),
    failParentOnFailure: integer("fail_parent_on_failure").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`timezone('utc', now())`),
    processAt: timestamp("process_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("idx_queue_jobs_polling").on(
      table.queueName,
      table.status,
      table.priority,
      table.createdAt
    ),
    index("idx_queue_jobs_delayed").on(table.queueName, table.processAt),
    index("idx_queue_jobs_active_groups").on(table.queueName, table.groupKey),
    index("idx_queue_jobs_stats").on(table.queueName, table.status),
  ]
)

export type QueueJob = typeof queueJobs.$inferSelect
export type InsertQueueJob = typeof queueJobs.$inferInsert
