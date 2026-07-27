import { queueFlows, queueJobs } from "@vorsteh-queue/adapter-drizzle"
import { defineRelations } from "drizzle-orm"

export { queueFlows, queueJobs } from "@vorsteh-queue/adapter-drizzle"

export const relations = defineRelations({ queueFlows, queueJobs })
