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
    attempts: integer("attempts").default(0).notNull(),
    cancellationReason: text("cancellation_reason"),
    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
      mode: "date",
    }),
    childrenCompleted: integer("children_completed").default(0).notNull(),
    childrenCount: integer("children_count").default(0).notNull(),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`timezone('utc', now())`),
    cron: varchar("cron", { length: 255 }),
    dependsOn: jsonb("depends_on"),
    error: jsonb("error"),
    failParentOnFailure: integer("fail_parent_on_failure").default(0).notNull(),
    failedAt: timestamp("failed_at", { withTimezone: true, mode: "date" }),
    flowId: uuid("flow_id"),
    groupKey: varchar("group_key", { length: 255 }),
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    maxAttempts: integer("max_attempts").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    onDependencyFailure: varchar("on_dependency_failure", { length: 10 }),
    parentId: uuid("parent_id"),
    payload: jsonb("payload").notNull(),
    priority: integer("priority").notNull(),
    processAt: timestamp("process_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),
    progress: integer("progress").default(0).notNull(),
    queueName: varchar("queue_name", { length: 255 }).notNull(),
    repeatCount: integer("repeat_count").default(0).notNull(),
    repeatEvery: integer("repeat_every"),
    repeatLimit: integer("repeat_limit"),
    result: jsonb("result"),
    signals: jsonb("signals"),
    status: varchar("status", { length: 50 }).notNull(),
    steps: jsonb("steps"),
    timeout: integer("timeout"),
    uniqueKey: varchar("unique_key", { length: 255 }),
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
