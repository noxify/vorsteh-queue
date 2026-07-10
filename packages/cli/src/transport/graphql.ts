/**
 * GraphQL transport — connects to a remote vorsteh-queue server.
 */

import type { FlowNode, Job, QueueStats } from "@vorsteh-queue/core"

import { CLIError } from "../errors"
import type { Transport } from "./types"

export function createGraphQLTransport(url: string, token?: string): Transport {
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
      method: "POST",
      headers,
      body: JSON.stringify({ query: gql, variables }),
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
      const healthUrl = url.replace(/\/graphql$/, "") + "/health"
      const headers: Record<string, string> = {}
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      let response: Response
      try {
        response = await fetch(healthUrl, { method: "GET", headers })
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
        "{ stats { pending delayed processing completed failed cancelled dead } }"
      )
      return result.stats
    },

    async getJob(id: string) {
      const result = await query<{ job: Job | null }>(
        `query($id: ID!) { job(id: $id) { id name status priority attempts maxAttempts progress payload createdAt processAt } }`,
        { id }
      )
      return result.job
    },

    async getDeadJobs(options) {
      const result = await query<{ deadJobs: readonly Job[] }>(
        `query($limit: Int, $offset: Int) { deadJobs(limit: $limit, offset: $offset) { id name status createdAt } }`,
        { limit: options?.limit, offset: options?.offset }
      )
      return result.deadJobs
    },

    async cancelJob(id: string, reason?: string) {
      const result = await query<{ cancelJob: boolean }>(
        `mutation($id: ID!, $reason: String) { cancelJob(id: $id, reason: $reason) }`,
        { id, reason }
      )
      return result.cancelJob
    },

    async retryJob(id: string) {
      const result = await query<{ retryJob: boolean }>(
        `mutation($id: ID!) { retryJob(id: $id) }`,
        { id }
      )
      return result.retryJob
    },

    async runJobNow(id: string) {
      const result = await query<{ runJobNow: boolean }>(
        `mutation($id: ID!) { runJobNow(id: $id) }`,
        { id }
      )
      return result.runJobNow
    },

    async deleteJob(id: string) {
      const result = await query<{ deleteJob: boolean }>(
        `mutation($id: ID!) { deleteJob(id: $id) }`,
        { id }
      )
      return result.deleteJob
    },

    async redriveJob(id: string) {
      await query<{ redriveJob: boolean }>(
        `mutation($id: ID!) { redriveJob(id: $id) }`,
        { id }
      )
    },

    async redriveAll(filter) {
      const result = await query<{ redriveAll: number }>(
        `mutation($name: String) { redriveAll(name: $name) }`,
        { name: filter?.name }
      )
      return result.redriveAll
    },

    async clearJobs(status) {
      const result = await query<{ clearJobs: number }>(
        `mutation($status: JobStatus) { clearJobs(status: $status) }`,
        { status }
      )
      return result.clearJobs
    },

    async size() {
      const result = await query<{ size: number }>("{ size }")
      return result.size
    },

    async getFlowTree(flowId: string) {
      const result = await query<{ flowTree: FlowNode | null }>(
        `query($flowId: String!) { flowTree(flowId: $flowId) }`,
        { flowId }
      )
      return result.flowTree
    },
  }
}
