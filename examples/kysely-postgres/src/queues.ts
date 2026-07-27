import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-kysely"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

export const adapter = new PostgresQueueAdapter(db)
export const queue = new Queue(adapter, { name: "advanced-queue" })
