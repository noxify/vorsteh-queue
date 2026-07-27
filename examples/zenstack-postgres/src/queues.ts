import { PostgresZenstackQueueAdapter } from "@vorsteh-queue/adapter-zenstack"
import { Queue } from "@vorsteh-queue/core"

import { db } from "./database"

export const adapter = new PostgresZenstackQueueAdapter(db)
export const queue = new Queue(adapter, { name: "email-queue" })
