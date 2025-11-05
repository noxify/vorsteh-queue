import { createQueueJobsTable } from "@vorsteh-queue/adapter-drizzle"

export const customQueueJobs = createQueueJobsTable("custom_queue_jobs", "custom_schema")
