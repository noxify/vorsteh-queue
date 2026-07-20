import "server-only"
import type { QueueAdapter } from "@vorsteh-queue/core"
import { loadConfig } from "c12"

import type { QueueClient } from "./queue-client"

interface QueueConfigFile {
  adapter: QueueAdapter
}

/**
 * Create a queue client that talks directly to the adapter
 * loaded from queue.config.ts via c12.
 */
export async function createDirectClient(): Promise<QueueClient> {
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

  const adapter = config.adapter

  return {
    async getStats() {
      return adapter.getQueueStats()
    },

    async getJobs(options) {
      const where: Record<string, unknown> = {}
      if (options?.status) where.status = { equals: options.status }
      if (options?.name) where.name = { contains: options.name }

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
  }
}
