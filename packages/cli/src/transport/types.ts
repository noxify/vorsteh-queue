/**
 * Transport interface — abstracts direct adapter vs remote GraphQL access.
 */

import type {
  FlowSummary,
  FlowTree,
  Job,
  JobStatus,
  PaginationOptions,
  QueueStats,
} from "@vorsteh-queue/core"
import type { JobWhereInput } from "@vorsteh-queue/query-builder"

export interface Transport {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  getStats: () => Promise<QueueStats>
  getJob: (id: string) => Promise<Job | null>
  getJobs: (options?: {
    where?: JobWhereInput
    limit?: number
    offset?: number
  }) => Promise<readonly Job[]>
  getQueues: () => Promise<readonly string[]>
  getDeadJobs: (options?: PaginationOptions) => Promise<readonly Job[]>
  cancelJob: (id: string, reason?: string) => Promise<boolean>
  retryJob: (id: string) => Promise<boolean>
  runJobNow: (id: string) => Promise<boolean>
  deleteJob: (id: string) => Promise<boolean>
  redriveJob: (id: string) => Promise<void>
  redriveAll: (filter?: { name?: string }) => Promise<number>
  clearJobs: (status?: JobStatus) => Promise<number>
  size: (where?: JobWhereInput) => Promise<number>
  getFlowTree: (flowId: string) => Promise<FlowTree | null>
  getFlows: (options?: {
    limit?: number
    offset?: number
    status?: string
  }) => Promise<readonly FlowSummary[]>
}
