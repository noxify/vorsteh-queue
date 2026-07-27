import { PostgresSequelizeQueueAdapter } from "@vorsteh-queue/adapter-sequelize"
import { Queue } from "@vorsteh-queue/core"

import { sequelize } from "./database"

export const adapter = new PostgresSequelizeQueueAdapter(sequelize)
export const queue = new Queue(adapter, { name: "email-queue" })
