import { postgresSchema } from "@vorsteh-queue/adapter-drizzle"
import { defineRelations } from "drizzle-orm"

export const { queueJobs } = postgresSchema

export const relations = defineRelations({ queueJobs })
