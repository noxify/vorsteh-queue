import { PostgresTypeormQueueAdapter } from "@vorsteh-queue/adapter-typeorm"
import { Queue } from "@vorsteh-queue/core"

import { dataSource } from "./database"

export const adapter = new PostgresTypeormQueueAdapter(dataSource)
export const queue = new Queue(adapter, { name: "email-queue" })
