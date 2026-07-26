/**
 * CLI configuration for direct mode.
 *
 * The dashboard command reads this file to connect directly to the adapter.
 * Connects to the PGlite socket server started by `pnpm dev:prod`.
 */
import { PostgresQueueAdapter, queueJobs } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"
import { defineRelations } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"

const relations = defineRelations({ queueJobs })

const port = process.env.PGLITE_PORT ?? "5488"
const db = drizzle({
  connection: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
  relations,
})

const adapter = new PostgresQueueAdapter(db as never)

const emailQueue = new Queue(adapter, { name: "email" })
const dataQueue = new Queue(adapter, { name: "data-processing" })
const notificationQueue = new Queue(adapter, { name: "notifications" })
const deploymentQueue = new Queue(adapter, { name: "deployments" })

export default {
  adapter,
  defaultQueue: "email",
  queues: [emailQueue, dataQueue, notificationQueue, deploymentQueue],
}
