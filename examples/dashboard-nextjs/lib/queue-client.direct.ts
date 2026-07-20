import "server-only"
import type { Queue, QueueAdapter } from "@vorsteh-queue/core"
import { loadConfig } from "c12"

import type { QueueClient } from "./queue-client"

interface QueueConfigFile {
  adapter: QueueAdapter
  queues: readonly Queue[]
  defaultQueue?: string
}

const globalForConfig = globalThis as unknown as {
  __queueConfig?: QueueConfigFile
}

async function getConfig(): Promise<QueueConfigFile> {
  if (globalForConfig.__queueConfig) {
    return globalForConfig.__queueConfig
  }

  const { config } = await loadConfig<QueueConfigFile>({
    name: "queue",
    cwd: process.cwd(),
  })

  if (!config?.adapter) {
    throw new Error(
      "No adapter found in queue.config.ts. " +
        "Make sure your config exports an adapter instance."
    )
  }

  if (!config.queues || config.queues.length === 0) {
    throw new Error(
      "No queues configured in queue.config.ts. " +
        "Add a queues array with at least one Queue instance."
    )
  }

  globalForConfig.__queueConfig = config as QueueConfigFile
  return globalForConfig.__queueConfig
}

/**
 * Create a queue client that talks directly to the adapter
 * loaded from queue.config.ts via c12.
 *
 * @param queueName - Queue to operate on (uses defaultQueue from config if not specified)
 */
export async function createDirectClient(
  queueName?: string
): Promise<QueueClient> {
  const config = await getConfig()

  const selectedName =
    queueName ?? config.defaultQueue ?? config.queues[0]?.name
  const queue = config.queues.find((q) => q.name === selectedName)

  if (!queue) {
    throw new Error(
      `Queue "${selectedName}" not found in queue.config.ts. ` +
        `Available: ${config.queues.map((q) => q.name).join(", ")}`
    )
  }

  const { adapter } = config
  adapter.setQueueName(queue.name)

  return {
    async getStats() {
      return adapter.getQueueStats()
    },

    async getJobs(options) {
      const where: Record<string, unknown> = {}
      if (options?.status) {
        where.status = { equals: options.status }
      }
      if (options?.name) {
        where.name = { contains: options.name }
      }

      return adapter.getJobs({
        where: Object.keys(where).length > 0 ? where : undefined,
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
      })
    },

    async getJobById(id) {
      return adapter.getJobById(id)
    },

    async getDeadJobs(options) {
      return adapter.getDeadJobs({
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
      })
    },

    async getFlows(options) {
      return adapter.getFlows({
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
      })
    },

    async getFlowTree(flowId) {
      return adapter.getFlowTree(flowId)
    },

    async cancelJob(id, reason) {
      await adapter.cancelJob(id, reason)
    },

    async retryJob(id) {
      await adapter.retryJob(id)
    },

    async redriveJob(id) {
      await adapter.redriveJob(id)
    },

    async redriveAllDeadJobs() {
      await adapter.redriveJobs()
    },

    async runJobNow(id) {
      await adapter.runJobNow(id)
    },

    async deleteJob(id) {
      await adapter.deleteJob(id)
    },

    async getQueueNames() {
      return config.queues.map((q) => q.name)
    },

    async getDefaultQueueName() {
      return config.defaultQueue ?? config.queues[0]?.name ?? ""
    },
  }
}
