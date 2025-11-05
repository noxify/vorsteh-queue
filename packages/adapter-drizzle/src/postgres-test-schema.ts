import { index, pgTable } from "drizzle-orm/pg-core"

import { columns, createQueueJobsTable } from "./helpers"

export const queueJobs = pgTable("queue_jobs", columns, (table) => [
  index("idx_queue_jobs_status_priority").on(
    table.queueName,
    table.status,
    table.priority,
    table.createdAt,
  ),
  index("idx_queue_jobs_process_at").on(table.processAt),
])

const { schema, table } = createQueueJobsTable("custom_queue_jobs", "custom_schema")

export const customSchema = schema
export const customQueueJobs = table

export type QueueJob = typeof queueJobs.$inferSelect
export type InsertQueueJob = typeof queueJobs.$inferInsert

export type CustomQueueJob = typeof customQueueJobs.$inferSelect
export type InsertCustomQueueJob = typeof customQueueJobs.$inferInsert
