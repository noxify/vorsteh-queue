import { createQueueJobsTable } from "@vorsteh-queue/adapter-drizzle"

export const { table: customQueueJobs, schema: customSchema } = createQueueJobsTable(
  "custom_queue_jobs",
  "custom_schema",
)
