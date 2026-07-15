import type { Job, QueueStats } from "@vorsteh-queue/core"
import { vi } from "vitest"

import type { Transport } from "../../src/transport/types"

const DEFAULT_STATS: QueueStats = {
  cancelled: 0,
  completed: 5,
  dead: 1,
  delayed: 2,
  failed: 3,
  pending: 10,
  processing: 2,
  "waiting-children": 0,
}

const DEFAULT_JOB: Job = {
  attempts: 1,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  id: "job-1",
  maxAttempts: 3,
  name: "send-email",
  payload: { to: "user@example.com" },
  priority: 2,
  processAt: new Date("2026-01-01T00:00:00Z"),
  progress: 0,
  repeatCount: 0,
  status: "pending",
}

/**
 * Create a fully-mocked Transport instance for tests.
 */
export function createMockTransport(overrides?: {
  stats?: QueueStats
  jobs?: readonly Job[]
  job?: Job | null
  queues?: readonly string[]
}): Transport {
  return {
    cancelJob: vi.fn().mockResolvedValue(true),
    clearJobs: vi.fn().mockResolvedValue(0),
    connect: vi.fn().mockResolvedValue(undefined),
    deleteJob: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getDeadJobs: vi.fn().mockResolvedValue([]),
    getFlowTree: vi.fn().mockResolvedValue(null),
    getJob: vi.fn().mockResolvedValue(overrides?.job ?? DEFAULT_JOB),
    getJobs: vi.fn().mockResolvedValue(overrides?.jobs ?? [DEFAULT_JOB]),
    getQueues: vi.fn().mockResolvedValue(overrides?.queues ?? ["test-queue"]),
    getStats: vi.fn().mockResolvedValue(overrides?.stats ?? DEFAULT_STATS),
    redriveAll: vi.fn().mockResolvedValue(0),
    redriveJob: vi.fn().mockResolvedValue(undefined),
    retryJob: vi.fn().mockResolvedValue(true),
    runJobNow: vi.fn().mockResolvedValue(true),
    size: vi.fn().mockResolvedValue(10),
  }
}

export { DEFAULT_JOB, DEFAULT_STATS }
