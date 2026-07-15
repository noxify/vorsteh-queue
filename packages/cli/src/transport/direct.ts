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
    async cancelJob(id: string, reason?: string) {
      return adapter.cancelJob(id, reason)
    },
    async clearJobs(status) {
      return adapter.clearJobs(status)
    },
    async connect() {
      await adapter.connect()
    },
    async deleteJob(id: string) {
      return adapter.deleteJob(id)
    },
    async disconnect() {
      await adapter.disconnect()
    },
    async getDeadJobs(options) {
      return adapter.getDeadJobs(options)
    },
    async getFlowTree(flowId: string) {
      return adapter.getFlowTree(flowId)
    },
    async getJob(id: string) {
      return adapter.getJobById(id)
    },
    async getJobs(options) {
      return adapter.getJobs({
        limit: options?.limit,
        name: options?.name,
        offset: options?.offset,
        status: options?.status,
      })
    },
    async getQueues() {
      return [queueName]
    },
    async getStats() {
      return adapter.getQueueStats()
    },
    async redriveAll(filter) {
      return adapter.redriveJobs(filter)
    },
    async redriveJob(id: string) {
      await adapter.redriveJob(id)
    },
    async retryJob(id: string) {
      return adapter.retryJob(id)
    },
    async runJobNow(id: string) {
      return adapter.runJobNow(id)
    },
    async size() {
      return adapter.size()
    },
  }
}
