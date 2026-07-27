import { createQueueJobsTable } from "@vorsteh-queue/adapter-drizzle"
import { defineRelations } from "drizzle-orm"

export const { table: customQueueJobs, schema: customSchema } =
  createQueueJobsTable("custom_queue_jobs", "custom_schema")

export const relations = defineRelations({ customQueueJobs }, (_r) => ({
  customQueueJobs: {},
}))
