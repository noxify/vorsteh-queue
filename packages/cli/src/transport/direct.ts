/**
 * Direct transport — uses a QueueAdapter instance directly.
 */

import type { QueueAdapter } from "@vorsteh-queue/core"

import type { Transport } from "./types"

export function createDirectTransport(
  adapter: QueueAdapter,
  queueName: string
): Transport {
  adapter.setQueueName(queueName)

  return {
    async connect() {
      await adapter.connect()
    },
    async disconnect() {
      await adapter.disconnect()
    },
    async getStats() {
      return adapter.getQueueStats()
    },
    async getJob(id: string) {
      return adapter.getJobById(id)
    },
    async getDeadJobs(options) {
      return adapter.getDeadJobs(options)
    },
    async cancelJob(id: string, reason?: string) {
      return adapter.cancelJob(id, reason)
    },
    async retryJob(id: string) {
      return adapter.retryJob(id)
    },
    async runJobNow(id: string) {
      return adapter.runJobNow(id)
    },
    async deleteJob(id: string) {
      return adapter.deleteJob(id)
    },
    async redriveJob(id: string) {
      await adapter.redriveJob(id)
    },
    async redriveAll(filter) {
      return adapter.redriveJobs(filter)
    },
    async clearJobs(status) {
      return adapter.clearJobs(status)
    },
    async size() {
      return adapter.size()
    },
    async getFlowTree(flowId: string) {
      return adapter.getFlowTree(flowId)
    },
  }
}
