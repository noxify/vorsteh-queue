import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

export const emailQueue = new Queue(new PostgresQueueAdapter(db, "email-queue"), {
  name: "email-queue",
  concurrency: 3,
})
export const imageQueue = new Queue(new PostgresQueueAdapter(db, "image-queue"), {
  name: "image-queue",
  concurrency: 2,
})
export const reportQueue = new Queue(new PostgresQueueAdapter(db, "report-queue"), {
  name: "report-queue",
})
