import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

/** Create a fresh adapter instance (each Queue/Worker needs its own) */
export function createAdapter(): PostgresQueueAdapter {
  return new PostgresQueueAdapter(db)
}

// Multiple queues to demonstrate different use cases
export const emailQueue = new Queue(createAdapter(), {
  name: "email",
  removeOnComplete: 50,
  removeOnFail: 20,
})

export const dataQueue = new Queue(createAdapter(), {
  name: "data-processing",
  removeOnComplete: 20,
  removeOnFail: 10,
})

export const notificationQueue = new Queue(createAdapter(), {
  name: "notifications",
  removeOnComplete: 100,
  removeOnFail: 30,
})

export const deploymentQueue = new Queue(createAdapter(), {
  name: "deployments",
})
