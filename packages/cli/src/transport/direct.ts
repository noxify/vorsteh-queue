/**
 * Direct transport — uses a QueueAdapter instance directly.
 */

import type {
  FlowAdapter,
  FlowListOptions,
  QueueAdapter,
} from "@vorsteh-queue/core"

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
      return (adapter as unknown as FlowAdapter).getFlowTree(flowId)
    },
    async getFlows(options) {
      return (adapter as unknown as FlowAdapter).getFlows(
        options as FlowListOptions | undefined
      )
    },
    async getJob(id: string) {
      return adapter.getJobById(id)
    },
    async getJobs(options) {
      return adapter.getJobs({
        limit: options?.limit,
        offset: options?.offset,
        where: options?.where,
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
    async size(where) {
      return adapter.size(where)
    },
  }
}
