import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

export const adapter = new PostgresQueueAdapter(db, {
  modelName: "customQueueJobs",
})
export const queue = new Queue(adapter, { name: "advanced-queue" })
