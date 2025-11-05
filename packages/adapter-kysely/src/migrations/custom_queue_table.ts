import { createQueueJobsTable } from "../helpers"

export const { up, down } = createQueueJobsTable("custom_queue_jobs", "custom_schema")
