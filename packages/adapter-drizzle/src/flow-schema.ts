import { sql } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

export const queueFlows = pgTable(
  "queue_flows",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    flowId: uuid("flow_id").notNull(),
    parentNodeId: uuid("parent_node_id"),
    jobId: uuid("job_id"),
    queueName: varchar("queue_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    options: jsonb("options"),
    status: varchar("status", { length: 50 }).notNull(),
    failureStrategy: varchar("failure_strategy", { length: 20 })
      .default("default")
      .notNull(),
    childrenCount: integer("children_count").default(0).notNull(),
    childrenCompleted: integer("children_completed").default(0).notNull(),
    result: jsonb("result"),
    error: jsonb("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`timezone('utc', now())`),
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    index("idx_queue_flows_flow_id").on(table.flowId),
    index("idx_queue_flows_parent_node_id").on(table.parentNodeId),
    index("idx_queue_flows_job_id").on(table.jobId),
    index("idx_queue_flows_status").on(table.flowId, table.status),
  ]
)

export type QueueFlow = typeof queueFlows.$inferSelect
export type InsertQueueFlow = typeof queueFlows.$inferInsert
