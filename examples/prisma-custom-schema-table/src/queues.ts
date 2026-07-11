import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
import { Queue } from "@vorsteh-queue/core"

import { prisma } from "./database"

export const adapter = new PostgresPrismaQueueAdapter(prisma, {
  modelName: "CustomQueueJob",
  schemaName: "custom_schema",
  tableName: "custom_queue_jobs",
})
export const queue = new Queue(adapter, { name: "email-queue" })
