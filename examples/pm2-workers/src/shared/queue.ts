import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

// Shared adapter — used by both Queue (producer) and Worker (consumer) instances
export const adapter = new PostgresQueueAdapter(db)

// Queue instance — producer only (adding jobs, stats, management)
export const emailQueue = new Queue(adapter, { name: "email-queue" })
export const imageQueue = new Queue(adapter, { name: "image-queue" })
export const reportQueue = new Queue(adapter, { name: "report-queue" })
