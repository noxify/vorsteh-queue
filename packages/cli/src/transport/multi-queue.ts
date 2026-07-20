/**
 * Multi-queue transport wrapper — allows switching the active queue
 * at runtime without recreating the transport.
 */

import type { QueueAdapter } from "@vorsteh-queue/core"

import { createDirectTransport } from "./direct"
import { createGraphQLTransport } from "./graphql"
import type { Transport } from "./types"

export interface MultiQueueTransport extends Transport {
  /** Currently active queue name */
  readonly activeQueue: string
  /** Switch the active queue */
  switchQueue: (queueName: string) => void
}

/**
 * Create a multi-queue transport (GraphQL mode) that can switch between queues.
 *
 * @param url - GraphQL endpoint URL
 * @param token - Authentication token
 * @param initialQueue - Initial queue to target
 * @returns A transport with queue-switching capability
 */
export function createMultiQueueTransport(
  url: string,
  token?: string,
  initialQueue?: string
): MultiQueueTransport {
  const state = { queue: initialQueue ?? "" }
  let inner: Transport = createGraphQLTransport(url, token, state.queue)

  return {
    get activeQueue() {
      return state.queue
    },

    switchQueue(queueName: string) {
      state.queue = queueName
      inner = createGraphQLTransport(url, token, state.queue)
    },

    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    getStats: () => inner.getStats(),
    getJob: (id) => inner.getJob(id),
    getJobs: (options) => inner.getJobs(options),
    getQueues: () => inner.getQueues(),
    getDeadJobs: (options) => inner.getDeadJobs(options),
    cancelJob: (id, reason) => inner.cancelJob(id, reason),
    retryJob: (id) => inner.retryJob(id),
    runJobNow: (id) => inner.runJobNow(id),
    deleteJob: (id) => inner.deleteJob(id),
    redriveJob: (id) => inner.redriveJob(id),
    redriveAll: (filter) => inner.redriveAll(filter),
    clearJobs: (status) => inner.clearJobs(status),
    size: (where) => inner.size(where),
    getFlowTree: (flowId) => inner.getFlowTree(flowId),
    getFlows: (options) => inner.getFlows(options),
  }
}

/**
 * Create a multi-queue transport (direct adapter mode) that can switch between queues.
 *
 * @param adapter - Queue adapter instance
 * @param queueNames - Available queue names
 * @param initialQueue - Initial queue to target
 * @returns A transport with queue-switching capability
 */
export function createDirectMultiQueueTransport(
  adapter: QueueAdapter,
  queueNames: readonly string[],
  initialQueue?: string
): MultiQueueTransport {
  const state = { queue: initialQueue ?? queueNames[0] ?? "" }
  let inner: Transport = createDirectTransport(adapter, state.queue)

  return {
    get activeQueue() {
      return state.queue
    },

    switchQueue(queueName: string) {
      state.queue = queueName
      adapter.setQueueName(queueName)
      inner = createDirectTransport(adapter, state.queue)
    },

    connect: () => inner.connect(),
    disconnect: () => inner.disconnect(),
    getStats: () => inner.getStats(),
    getJob: (id) => inner.getJob(id),
    getJobs: (options) => inner.getJobs(options),
    getQueues: async () => [...queueNames],
    getDeadJobs: (options) => inner.getDeadJobs(options),
    cancelJob: (id, reason) => inner.cancelJob(id, reason),
    retryJob: (id) => inner.retryJob(id),
    runJobNow: (id) => inner.runJobNow(id),
    deleteJob: (id) => inner.deleteJob(id),
    redriveJob: (id) => inner.redriveJob(id),
    redriveAll: (filter) => inner.redriveAll(filter),
    clearJobs: (status) => inner.clearJobs(status),
    size: (where) => inner.size(where),
    getFlowTree: (flowId) => inner.getFlowTree(flowId),
    getFlows: (options) => inner.getFlows(options),
  }
}
