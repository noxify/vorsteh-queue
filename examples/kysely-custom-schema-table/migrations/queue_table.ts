import { createQueueJobsTable } from "@vorsteh-queue/adapter-kysely"

export const { up, down } = createQueueJobsTable("custom_queue_jobs", "custom_schema")
