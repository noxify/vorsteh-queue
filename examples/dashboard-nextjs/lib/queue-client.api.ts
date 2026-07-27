import "server-only"
import { env } from "./env"
import type { QueueClient } from "./queue-client"

/**
 * Create a queue client that connects to a remote GraphQL API.
 *
 * Requires QUEUE_API_URL (and optionally QUEUE_API_TOKEN) to be set.
 *
 * @param _queueName - Queue name (passed as variable to GraphQL queries that support it)
 */
export function createApiClient(_queueName?: string): QueueClient {
  const url = env.QUEUE_API_URL
  if (!url) {
    throw new Error(
      "QUEUE_API_URL is required when QUEUE_MODE=api. " +
        "Set it to your GraphQL endpoint (e.g. http://localhost:4000/graphql)."
    )
  }

  const token = env.QUEUE_API_TOKEN
  const endpoint: string = url

  async function gql<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`GraphQL request failed: ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as {
      data: T
      errors?: { message: string }[]
    }
    if (json.errors?.length) {
      throw new Error(`GraphQL error: ${json.errors[0]?.message}`)
    }

    return json.data
  }

  return {
    async getStats() {
      const data = await gql<{
        stats: Awaited<ReturnType<QueueClient["getStats"]>>
      }>(`
        query { stats { pending delayed processing completed failed cancelled dead } }
      `)
      return data.stats
    },

    async getJobs(options) {
      const data = await gql<{
        jobs: Awaited<ReturnType<QueueClient["getJobs"]>>
      }>(
        `
        query Jobs($status: JobStatus, $name: String, $limit: Int, $offset: Int) {
          jobs(status: $status, name: $name, limit: $limit, offset: $offset) {
            id name status priority attempts maxAttempts progress createdAt groupKey
          }
        }
      `,
        {
          status: options?.status ?? null,
          name: options?.name ?? null,
          limit: options?.limit ?? 20,
          offset: options?.offset ?? 0,
        }
      )
      return data.jobs
    },

    async getJobById(id) {
      const data = await gql<{
        job: Awaited<ReturnType<QueueClient["getJobById"]>>
      }>(
        `
        query JobDetail($id: ID!) {
          job(id: $id) {
            id name payload status priority attempts maxAttempts progress
            groupKey uniqueKey cron createdAt processedAt completedAt failedAt cancelledAt
            result error { name message stack }
          }
        }
      `,
        { id }
      )
      return data.job
    },

    async getDeadJobs(options) {
      const data = await gql<{
        deadJobs: Awaited<ReturnType<QueueClient["getDeadJobs"]>>
      }>(
        `
        query DeadJobs($limit: Int, $offset: Int) {
          deadJobs(limit: $limit, offset: $offset) {
            id name status attempts maxAttempts failedAt error { message }
          }
        }
      `,
        { limit: options?.limit ?? 50, offset: options?.offset ?? 0 }
      )
      return data.deadJobs
    },

    async getFlows(options) {
      const data = await gql<{
        flows: Awaited<ReturnType<QueueClient["getFlows"]>>
      }>(
        `
        query Flows($limit: Int, $offset: Int) {
          flows(limit: $limit, offset: $offset) {
            flowId status createdAt completedAt rootNode { id name status }
          }
        }
      `,
        { limit: options?.limit ?? 20, offset: options?.offset ?? 0 }
      )
      return data.flows
    },

    async getFlowTree(flowId) {
      const data = await gql<{
        flowTree: Awaited<ReturnType<QueueClient["getFlowTree"]>>
      }>(
        `
        query FlowTree($flowId: String!) {
          flowTree(flowId: $flowId) {
            node { id name status flowId }
            children { node { id name status flowId } children { node { id name status flowId } children { node { id name status flowId } } } }
          }
        }
      `,
        { flowId }
      )
      return data.flowTree
    },

    async cancelJob(id, reason) {
      await gql(
        `mutation CancelJob($id: ID!, $reason: String) { cancelJob(id: $id, reason: $reason) }`,
        { id, reason }
      )
    },

    async retryJob(id) {
      await gql(`mutation RetryJob($id: ID!) { retryJob(id: $id) }`, { id })
    },

    async redriveJob(id) {
      await gql(`mutation RedriveJob($id: ID!) { redriveJob(id: $id) }`, { id })
    },

    async redriveAllDeadJobs() {
      await gql(`mutation RedriveAll { redriveAll }`)
    },

    async runJobNow(id) {
      await gql(`mutation RunJobNow($id: ID!) { runJobNow(id: $id) }`, { id })
    },

    async deleteJob(id) {
      await gql(`mutation DeleteJob($id: ID!) { deleteJob(id: $id) }`, { id })
    },

    async getQueueNames() {
      const data = await gql<{ queueNames: string[] }>(`query { queueNames }`)
      return data.queueNames
    },

    async getDefaultQueueName() {
      return _queueName ?? "default"
    },
  }
}
