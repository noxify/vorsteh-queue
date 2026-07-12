/**
 * E2E Tests: Job Dependencies
 *
 * Verifies full dependency lifecycle through Queue + Worker + MemoryAdapter:
 * - Jobs with unmet dependencies are not picked
 * - Jobs are picked after dependencies complete
 * - Failure cascade when dependency fails permanently
 * - Circular dependency detection at enqueue time
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import {
  CircularDependencyError,
  detectCircularDependencies,
} from "../src/dependencies"
import { Queue } from "../src/queue"
import type { JobWithProgress } from "../src/types"
import { Worker } from "../src/worker"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("E2E: Job Dependencies", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue
  let worker: Worker

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "dep-queue" })
    worker = new Worker(adapter, {
      concurrency: 3,
      name: "dep-queue",
      pollInterval: 10,
    })
    await queue.connect()
  })

  afterEach(async () => {
    if (worker.isRunning) {
      await worker.stop()
    }
    await queue.disconnect()
  })

  describe("Dependency Gating", () => {
    it("should not pick a job while its dependency is still processing", async () => {
      const processed: string[] = []

      worker.register("slow-task", async (job: JobWithProgress) => {
        await wait(80)
        processed.push((job.payload as { id: string }).id)
        return {}
      })

      worker.register("fast-task", async (job: JobWithProgress) => {
        processed.push((job.payload as { id: string }).id)
        return {}
      })

      // Add parent job (slow)
      const parent = await queue.add("slow-task", { id: "parent" })

      // Add child that depends on parent
      await queue.add("fast-task", { id: "child" }, { dependsOn: [parent.id] })

      worker.start()
      // Wait for first few polls but parent hasn't completed yet
      await wait(40)

      // Child should NOT have been picked yet (parent still processing)
      expect(processed).not.toContain("child")
    })

    it("should pick a job after its dependency completes", async () => {
      const processed: string[] = []

      worker.register("task", async (job: JobWithProgress) => {
        processed.push((job.payload as { id: string }).id)
        return {}
      })

      // Add parent job
      const parent = await queue.add("task", { id: "parent" })

      // Add child that depends on parent
      await queue.add("task", { id: "child" }, { dependsOn: [parent.id] })

      worker.start()
      // Wait long enough for parent to complete and child to be picked
      await wait(200)

      // Both should have been processed: parent first, then child
      expect(processed).toContain("parent")
      expect(processed).toContain("child")
      expect(processed.indexOf("parent")).toBeLessThan(
        processed.indexOf("child")
      )
    })

    it("should handle multi-level dependency chains", async () => {
      const processed: string[] = []

      worker.register("step", async (job: JobWithProgress) => {
        processed.push((job.payload as { order: number }).order.toString())
        return {}
      })

      const step1 = await queue.add("step", { order: 1 })
      const step2 = await queue.add(
        "step",
        { order: 2 },
        { dependsOn: [step1.id] }
      )
      await queue.add("step", { order: 3 }, { dependsOn: [step2.id] })

      worker.start()
      await wait(300)

      // All three should process in dependency order
      expect(processed).toStrictEqual(["1", "2", "3"])
    })
  })

  describe("Failure Cascade", () => {
    it("should fail dependent jobs when dependency moves to dead", async () => {
      const processed: string[] = []

      worker.register("fail-task", async () => {
        throw new Error("intentional failure")
      })

      worker.register("success-task", async (job: JobWithProgress) => {
        processed.push((job.payload as { id: string }).id)
        return {}
      })

      // Parent job that will fail (maxAttempts: 1 → goes to dead immediately)
      const parent = await queue.add(
        "fail-task",
        { id: "parent" },
        { maxAttempts: 1 }
      )

      // Child that depends on parent
      const child = await queue.add(
        "success-task",
        { id: "child" },
        { dependsOn: [parent.id] }
      )

      worker.start()
      await wait(150)

      // Child should NOT have been processed
      expect(processed).not.toContain("child")

      // Child should be in failed state due to cascade
      const childJob = await queue.getJob(child.id)
      expect(childJob?.status).toBe("failed")
      expect(childJob?.error?.name).toBe("DependencyFailedError")
    })

    it("should cascade failure through multiple levels", async () => {
      worker.register("fail-task", async () => {
        throw new Error("intentional failure")
      })

      worker.register("success-task", async () => ({}))

      const root = await queue.add(
        "fail-task",
        { id: "root" },
        { maxAttempts: 1 }
      )

      const mid = await queue.add(
        "success-task",
        { id: "mid" },
        { dependsOn: [root.id] }
      )

      const leaf = await queue.add(
        "success-task",
        { id: "leaf" },
        { dependsOn: [mid.id] }
      )

      worker.start()
      await wait(150)

      const midJob = await queue.getJob(mid.id)
      const leafJob = await queue.getJob(leaf.id)

      expect(midJob?.status).toBe("failed")
      expect(midJob?.error?.name).toBe("DependencyFailedError")
      expect(leafJob?.status).toBe("failed")
      expect(leafJob?.error?.name).toBe("DependencyFailedError")
    })
  })

  describe("Circular Dependency Detection", () => {
    it("should not throw for valid linear dependency chains via queue.add", async () => {
      const jobA = await queue.add("task", { id: "a" })
      const jobB = await queue.add(
        "task",
        { id: "b" },
        { dependsOn: [jobA.id] }
      )

      // Linear chain is fine
      await expect(
        queue.add("task", { id: "c" }, { dependsOn: [jobB.id] })
      ).resolves.toBeDefined()
    })

    it("should detect cycle via detectCircularDependencies utility", async () => {
      // Setup: jobB depends on "target-id", jobA depends on jobB
      // Cycle: target-id → [depends on jobA] → jobA → [depends on jobB] → jobB → [depends on target-id]
      const jobB = await adapter.addJob({
        attempts: 0,
        dependsOn: ["target-id"],
        maxAttempts: 3,
        name: "task",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      const jobA = await adapter.addJob({
        attempts: 0,
        dependsOn: [jobB.id],
        maxAttempts: 3,
        name: "task",
        payload: {},
        priority: 2,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        status: "pending",
      })

      // Detect: target-id depends on [jobA] → jobA depends on [jobB] → jobB depends on [target-id] → CYCLE
      await expect(
        detectCircularDependencies("target-id", [jobA.id], adapter)
      ).rejects.toThrow(CircularDependencyError)
    })
  })
})
