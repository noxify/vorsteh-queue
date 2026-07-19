import { PostgresMikroormQueueAdapter } from "@vorsteh-queue/adapter-mikroorm"
import { Queue } from "@vorsteh-queue/core"

import { orm } from "./database"

export const adapter = new PostgresMikroormQueueAdapter(orm)
export const queue = new Queue(adapter, { name: "email-queue" })
