import "server-only"
import type { FlowNode, Job, JobStatus, QueueStats } from "@vorsteh-queue/core"

/**
 * Abstract queue client interface used by pages and Server Actions.
 *
 * Two implementations are available:
 * - Direct: reads queue.config.ts via c12, talks to the adapter directly
 * - API: calls a remote GraphQL/REST endpoint
 *
 * Set QUEUE_MODE=direct (default) or QUEUE_MODE=api in .env to switch.
 */
export interface QueueClient {
  // ─── Queries ────────────────────────────────────────────────
  getStats(): Promise<QueueStats>
  getJobs(options?: {
    status?: JobStatus
    name?: string
    limit?: number
    offset?: number
  }): Promise<readonly Job[]>
  getJobById(id: string): Promise<Job | null>
  getDeadJobs(options?: {
    limit?: number
    offset?: number
  }): Promise<readonly Job[]>
  getFlows(options?: {
    limit?: number
    offset?: number
  }): Promise<readonly { flowId: string; rootJob: Job }[]>
  getFlowTree(flowId: string): Promise<FlowNode | null>

  // ─── Mutations ──────────────────────────────────────────────
  cancelJob(id: string, reason?: string): Promise<void>
  retryJob(id: string): Promise<void>
  redriveJob(id: string): Promise<void>
  redriveAllDeadJobs(): Promise<void>
  runJobNow(id: string): Promise<void>
  deleteJob(id: string): Promise<void>
}

let _client: QueueClient | undefined

/**
 * Get the queue client singleton (lazily initialized based on QUEUE_MODE).
 */
export async function getQueueClient(): Promise<QueueClient> {
  if (_client) return _client

  const mode = process.env.QUEUE_MODE ?? "direct"

  if (mode === "api") {
    const { createApiClient } = await import("./queue-client.api")
    _client = createApiClient()
  } else {
    const { createDirectClient } = await import("./queue-client.direct")
    _client = await createDirectClient()
  }

  return _client
}
