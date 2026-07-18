import type { Job, QueueStats } from "@vorsteh-queue/core"
import { vi } from "vitest"

import type { MultiQueueTransport } from "../../src/transport/multi-queue"
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
    connect: vi.fn<() => Promise<void>>().mockResolvedValue(),
    deleteJob: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn<() => Promise<void>>().mockResolvedValue(),
    getDeadJobs: vi.fn().mockResolvedValue([]),
    getFlowTree: vi.fn().mockResolvedValue(null),
    getJob: vi.fn().mockResolvedValue(overrides?.job ?? DEFAULT_JOB),
    getJobs: vi.fn().mockResolvedValue(overrides?.jobs ?? [DEFAULT_JOB]),
    getQueues: vi.fn().mockResolvedValue(overrides?.queues ?? ["test-queue"]),
    getStats: vi.fn().mockResolvedValue(overrides?.stats ?? DEFAULT_STATS),
    redriveAll: vi.fn().mockResolvedValue(0),
    redriveJob: vi.fn<() => Promise<void>>().mockResolvedValue(),
    retryJob: vi.fn().mockResolvedValue(true),
    runJobNow: vi.fn().mockResolvedValue(true),
    size: vi.fn().mockResolvedValue(10),
  }
}

/**
 * Create a mock MultiQueueTransport for dashboard tests.
 */
export function createMockMultiQueueTransport(overrides?: {
  stats?: QueueStats
  jobs?: readonly Job[]
  job?: Job | null
  queues?: readonly string[]
  initialQueue?: string
}): MultiQueueTransport {
  const base = createMockTransport(overrides)
  let currentQueue = overrides?.initialQueue ?? "test-queue"

  return {
    ...base,
    get activeQueue() {
      return currentQueue
    },
    switchQueue: vi.fn((q: string) => {
      currentQueue = q
    }),
  }
}

export { DEFAULT_JOB, DEFAULT_STATS }
