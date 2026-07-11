import * as fc from "fast-check"
import { describe, expect, it, vi } from "vitest"

import { Queue } from "../queue"
import type { QueueAdapter } from "../types"

/**
 * Creates a minimal QueueAdapter stub for testing getters.
 * Only `setQueueName` is functional since the Queue constructor calls it.
 */
function createMockAdapter(): QueueAdapter {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setQueueName: vi.fn(),
    addJob: vi.fn(),
    addJobs: vi.fn(),
    getJobById: vi.fn(),
    getNextJob: vi.fn(),
    getNextJobsForHandler: vi.fn(),
    updateJobStatus: vi.fn(),
    incrementJobAttempts: vi.fn(),
    updateJobProgress: vi.fn(),
    cancelJob: vi.fn(),
    cancelJobs: vi.fn(),
    getDeadJobs: vi.fn(),
    redriveJob: vi.fn(),
    redriveJobs: vi.fn(),
    getQueueStats: vi.fn(),
    size: vi.fn(),
    getJobs: vi.fn(),
    getFlows: vi.fn(),
    clearJobs: vi.fn(),
    cleanupJobs: vi.fn(),
    findJobByUniqueKey: vi.fn(),
    retryJob: vi.fn(),
    runJobNow: vi.fn(),
    deleteJob: vi.fn(),
    transaction: vi.fn(),
    updateJobSteps: vi.fn(),
    setJobSignal: vi.fn(),
    getFlowTree: vi.fn(),
    incrementChildrenCompleted: vi.fn(),
    getChildrenJobs: vi.fn(),
  } as unknown as QueueAdapter
}

describe("Feature: cli-multi-queue, Property 1: Queue name getter identity", () => {
  /**
   * Validates: Requirements 1.1, 1.2
   *
   * For any Queue instance constructed with a QueueConfig containing a `name` string,
   * the `.name` getter SHALL return the exact same string value without transformation.
   */
  it("should return the exact name string passed via QueueConfig", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (name) => {
        const adapter = createMockAdapter()
        const queue = new Queue(adapter, { name })

        expect(queue.name).toBe(name)
      }),
      { numRuns: 100 }
    )
  })
})

describe("Feature: cli-multi-queue, Property 2: Adapter getter identity", () => {
  /**
   * Validates: Requirements 1.3, 1.4
   *
   * For any Queue instance constructed with a QueueAdapter, the `.adapter` getter
   * SHALL return the exact same object reference that was passed to the constructor.
   */
  it("should return the exact adapter reference passed to the constructor", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (name) => {
        const adapter = createMockAdapter()
        const queue = new Queue(adapter, { name })

        expect(queue.adapter).toBe(adapter)
      }),
      { numRuns: 100 }
    )
  })
})
