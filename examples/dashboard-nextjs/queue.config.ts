/**
 * Queue configuration for the dashboard (direct mode).
 *
 * Loaded by c12 when QUEUE_MODE=direct (default).
 * Connects to the PGlite socket server started by `pnpm dev:queue`.
 *
 * Uses the same config format as the CLI:
 * { adapter, queues, defaultQueue }
 *
 * Note: We use process.env directly here because this file is loaded by c12
 * outside the Next.js runtime (t3-env is not available in this context).
 */

import {
  postgresSchema,
  PostgresQueueAdapter,
} from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"
import { defineRelations } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"

const { queueJobs } = postgresSchema
const relations = defineRelations({ queueJobs })

const db = drizzle({
  connection: {
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5488/postgres",
    max: 1,
  },
  relations,
})

const adapter = new PostgresQueueAdapter(db)

const emailQueue = new Queue(adapter, { name: "email" })
const dataQueue = new Queue(adapter, { name: "data-processing" })
const notificationQueue = new Queue(adapter, { name: "notifications" })
const deploymentQueue = new Queue(adapter, { name: "deployments" })

export default {
  adapter,
  queues: [emailQueue, dataQueue, notificationQueue, deploymentQueue],
  defaultQueue: "email",
}
