import { index, pgTable } from "drizzle-orm/pg-core"

import {
  columns,
  createQueueFlowsTable,
  createQueueJobsTable,
} from "../src/helpers"

export { queueFlows } from "../src/flow-schema"

export const queueJobs = pgTable("queue_jobs", columns, (table) => [
  index("idx_queue_jobs_status_priority").on(
    table.queueName,
    table.status,
    table.priority,
    table.createdAt
  ),
  index("idx_queue_jobs_process_at").on(table.processAt),
])

const { schema, table } = createQueueJobsTable(
  "custom_queue_jobs",
  "custom_schema"
)

const { table: customFlowTable } = createQueueFlowsTable(
  "custom_queue_flows",
  "custom_schema"
)

export const customSchema = schema
export const customQueueJobs = table
export const customQueueFlows = customFlowTable

export type QueueJob = typeof queueJobs.$inferSelect
export type InsertQueueJob = typeof queueJobs.$inferInsert

export type CustomQueueJob = typeof customQueueJobs.$inferSelect
export type InsertCustomQueueJob = typeof customQueueJobs.$inferInsert
