import "server-only"
import type { FlowNode, Job, JobStatus, QueueStats } from "@vorsteh-queue/core"

import { env } from "./env"

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
  getStats: () => Promise<QueueStats>
  getJobs: (options?: {
    status?: JobStatus
    name?: string
    limit?: number
    offset?: number
  }) => Promise<readonly Job[]>
  getJobById: (id: string) => Promise<Job | null>
  getDeadJobs: (options?: {
    limit?: number
    offset?: number
  }) => Promise<readonly Job[]>
  getFlows: (options?: {
    limit?: number
    offset?: number
  }) => Promise<readonly { flowId: string; rootJob: Job }[]>
  getFlowTree: (flowId: string) => Promise<FlowNode | null>

  // ─── Mutations ──────────────────────────────────────────────
  cancelJob: (id: string, reason?: string) => Promise<void>
  retryJob: (id: string) => Promise<void>
  redriveJob: (id: string) => Promise<void>
  redriveAllDeadJobs: () => Promise<void>
  runJobNow: (id: string) => Promise<void>
  deleteJob: (id: string) => Promise<void>

  // ─── Meta ───────────────────────────────────────────────────
  getQueueNames: () => Promise<readonly string[]>
  getDefaultQueueName: () => Promise<string>
}

/**
 * Get a queue client for the specified queue name.
 *
 * @param queueName - Queue to operate on (uses defaultQueue from config if not specified)
 */
export async function getQueueClient(queueName?: string): Promise<QueueClient> {
  if (env.QUEUE_MODE === "api") {
    const { createApiClient } = await import("./queue-client.api")
    return createApiClient(queueName)
  }

  const { createDirectClient } = await import("./queue-client.direct")
  return createDirectClient(queueName)
}
