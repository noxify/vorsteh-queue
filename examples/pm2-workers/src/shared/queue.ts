import { DrizzleQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

export const emailQueue = new Queue(new DrizzleQueueAdapter(db, "email-queue"), {
  name: "email-queue",
  concurrency: 3,
})
export const imageQueue = new Queue(new DrizzleQueueAdapter(db, "image-queue"), {
  name: "image-queue",
  concurrency: 2,
})
export const reportQueue = new Queue(new DrizzleQueueAdapter(db, "report-queue"), {
  name: "report-queue",
})
