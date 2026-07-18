import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

// Shared Drizzle adapter backed by PGlite (in-memory embedded Postgres)
export const adapter = new PostgresQueueAdapter(db)

// Multiple queues to demonstrate different use cases
export const emailQueue = new Queue(adapter, {
  name: "email",
  removeOnComplete: 50,
  removeOnFail: 20,
})

export const dataQueue = new Queue(adapter, {
  name: "data-processing",
  removeOnComplete: 20,
  removeOnFail: 10,
})

export const notificationQueue = new Queue(adapter, {
  name: "notifications",
  removeOnComplete: 100,
  removeOnFail: 30,
})
