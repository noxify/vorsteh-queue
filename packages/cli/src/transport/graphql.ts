/**
 * GraphQL transport — connects to a remote vorsteh-queue server.
 */

import type { FlowNode, Job, QueueStats } from "@vorsteh-queue/core"

import { CLIError } from "../errors"
import type { Transport } from "./types"

export function createGraphQLTransport(
  url: string,
  token?: string,
  queueName?: string
): Transport {
  async function query<TResult>(
    gql: string,
    variables?: Record<string, unknown>
  ): Promise<TResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(url, {
      body: JSON.stringify({ query: gql, variables }),
      headers,
      method: "POST",
    })

    if (!response.ok) {
      throw new Error(
        `GraphQL request failed: ${response.status} ${response.statusText}`
      )
    }

    const body = (await response.json()) as {
      data?: TResult
      errors?: { message: string }[]
    }

    if (body.errors && body.errors.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      throw new Error(`GraphQL error: ${body.errors[0]!.message}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return body.data!
  }

  return {
    async connect() {
      const healthUrl = `${url.replace(/\/graphql$/u, "")}/health`
      const headers: Record<string, string> = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      let response: Response
      try {
        response = await fetch(healthUrl, { headers, method: "GET" })
      } catch {
        throw new CLIError(
          `Could not connect to ${healthUrl}. Verify the server is running and the URL is correct.`
        )
      }

      if (response.status === 401) {
        throw new CLIError(
          "Request failed with 401 Unauthorized.\n" +
            "The server rejected the request.\n" +
            "This may be caused by:\n" +
            " - Missing authentication\n" +
            " - Invalid or expired token\n" +
            " - Custom authentication middleware"
        )
      }

      if (!response.ok) {
        throw new CLIError(
          `Health check failed: ${response.status} ${response.statusText}`
        )
      }
    },
    // eslint-disable-next-line no-empty-function
    async disconnect() {},

    async getStats() {
      const result = await query<{ stats: QueueStats }>(
        "query($queue: String!) { stats(queue: $queue) { pending delayed processing completed failed cancelled dead } }",
        { queue: queueName }
      )
      return result.stats
    },

    async getJob(id: string) {
      const result = await query<{ job: Job | null }>(
        `query($id: ID!, $queue: String) { job(id: $id, queue: $queue) { id name status priority attempts maxAttempts progress payload createdAt processAt } }`,
        { id, queue: queueName }
      )
      return result.job
    },

    async getJobs(options) {
      const result = await query<{ jobs: readonly Job[] }>(
        `query($queue: String!, $status: JobStatus, $name: String, $limit: Int, $offset: Int) { jobs(queue: $queue, status: $status, name: $name, limit: $limit, offset: $offset) { id name status priority attempts maxAttempts progress createdAt processAt error { name message } } }`,
        {
          limit: options?.limit,
          name: options?.name,
          offset: options?.offset,
          queue: queueName,
          status: options?.status,
        }
      )
      return result.jobs
    },

    async getQueues() {
      const result = await query<{ queues: readonly { name: string }[] }>(
        `query { queues { name } }`
      )
      return result.queues.map((q) => q.name)
    },

    async getDeadJobs(options) {
      const result = await query<{ deadJobs: readonly Job[] }>(
        `query($queue: String!, $limit: Int, $offset: Int) { deadJobs(queue: $queue, limit: $limit, offset: $offset) { id name status createdAt } }`,
        { limit: options?.limit, offset: options?.offset, queue: queueName }
      )
      return result.deadJobs
    },

    async cancelJob(id: string, reason?: string) {
      const result = await query<{ cancelJob: boolean }>(
        `mutation($id: ID!, $queue: String!, $reason: String) { cancelJob(id: $id, queue: $queue, reason: $reason) }`,
        { id, queue: queueName, reason }
      )
      return result.cancelJob
    },

    async retryJob(id: string) {
      const result = await query<{ retryJob: boolean }>(
        `mutation($id: ID!, $queue: String!) { retryJob(id: $id, queue: $queue) }`,
        { id, queue: queueName }
      )
      return result.retryJob
    },

    async runJobNow(id: string) {
      const result = await query<{ runJobNow: boolean }>(
        `mutation($id: ID!, $queue: String!) { runJobNow(id: $id, queue: $queue) }`,
        { id, queue: queueName }
      )
      return result.runJobNow
    },

    async deleteJob(id: string) {
      const result = await query<{ deleteJob: boolean }>(
        `mutation($id: ID!, $queue: String!) { deleteJob(id: $id, queue: $queue) }`,
        { id, queue: queueName }
      )
      return result.deleteJob
    },

    async redriveJob(id: string) {
      await query<{ redriveJob: boolean }>(
        `mutation($id: ID!, $queue: String!) { redriveJob(id: $id, queue: $queue) }`,
        { id, queue: queueName }
      )
    },

    async redriveAll(filter) {
      const result = await query<{ redriveAll: number }>(
        `mutation($queue: String!, $name: String) { redriveAll(queue: $queue, name: $name) }`,
        { name: filter?.name, queue: queueName }
      )
      return result.redriveAll
    },

    async clearJobs(status) {
      const result = await query<{ clearJobs: number }>(
        `mutation($queue: String!, $status: JobStatus) { clearJobs(queue: $queue, status: $status) }`,
        { queue: queueName, status }
      )
      return result.clearJobs
    },

    async size() {
      const result = await query<{ size: number }>(
        "query($queue: String!) { size(queue: $queue) }",
        { queue: queueName }
      )
      return result.size
    },

    async getFlowTree(flowId: string) {
      const result = await query<{ flowTree: FlowNode | null }>(
        `query($queue: String!, $flowId: String!) { flowTree(queue: $queue, flowId: $flowId) }`,
        { flowId, queue: queueName }
      )
      return result.flowTree
    },
  }
}
