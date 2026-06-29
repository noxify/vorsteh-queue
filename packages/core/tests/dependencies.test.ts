import { beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import {
  areDependenciesMet,
  CircularDependencyError,
  detectCircularDependencies,
} from "../src/dependencies"
import type { NewJob } from "../src/types"

function makeJob(overrides: Partial<NewJob> = {}): NewJob {
  return {
    name: "test",
    payload: {},
    status: "pending",
    priority: 2,
    attempts: 0,
    maxAttempts: 3,
    processAt: new Date(),
    progress: 0,
    repeatCount: 0,
    ...overrides,
  }
}

describe("Job Dependencies", () => {
  let adapter: MemoryQueueAdapter

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    await adapter.connect()
    adapter.setQueueName("test-queue")
  })

  describe(detectCircularDependencies, () => {
    it("should not throw for simple dependency chain", async () => {
      const jobA = await adapter.addJob(makeJob({ name: "a" }))
      const jobB = await adapter.addJob(
        makeJob({ name: "b", dependsOn: [jobA.id] })
      )

      await expect(
        detectCircularDependencies("new-job", [jobB.id], adapter)
      ).resolves.toBeUndefined()
    })

    it("should throw on direct circular dependency", async () => {
      const jobA = await adapter.addJob(
        makeJob({ name: "a", dependsOn: ["new-job"] })
      )

      await expect(
        detectCircularDependencies("new-job", [jobA.id], adapter)
      ).rejects.toThrow(CircularDependencyError)
    })

    it("should throw on indirect circular dependency", async () => {
      const jobA = await adapter.addJob(makeJob({ name: "a" }))
      // jobB depends on new-job (creating a cycle: new-job → jobA → jobB → new-job)
      const jobB = await adapter.addJob(
        makeJob({ name: "b", dependsOn: ["new-job"] })
      )
      // Update jobA to depend on jobB
      await adapter.updateJobSteps(jobA.id, []) // just to ensure job exists
      // We need jobA to depend on jobB — update via raw
      const jobAUpdated = await adapter.addJob(
        makeJob({ name: "a2", dependsOn: [jobB.id] })
      )

      await expect(
        detectCircularDependencies("new-job", [jobAUpdated.id], adapter)
      ).rejects.toThrow(CircularDependencyError)
    })
  })

  describe(areDependenciesMet, () => {
    it("should return true when no dependencies", async () => {
      const job = await adapter.addJob(makeJob())
      await expect(areDependenciesMet(job, adapter)).resolves.toBeTruthy()
    })

    it("should return true when all dependencies completed", async () => {
      const dep1 = await adapter.addJob(makeJob({ name: "dep1" }))
      const dep2 = await adapter.addJob(makeJob({ name: "dep2" }))
      await adapter.updateJobStatus(dep1.id, { status: "completed" })
      await adapter.updateJobStatus(dep2.id, { status: "completed" })

      const job = await adapter.addJob(
        makeJob({ dependsOn: [dep1.id, dep2.id] })
      )
      await expect(areDependenciesMet(job, adapter)).resolves.toBeTruthy()
    })

    it("should return false when dependencies not completed", async () => {
      const dep1 = await adapter.addJob(makeJob({ name: "dep1" }))
      const dep2 = await adapter.addJob(makeJob({ name: "dep2" }))
      await adapter.updateJobStatus(dep1.id, { status: "completed" })
      // dep2 still pending

      const job = await adapter.addJob(
        makeJob({ dependsOn: [dep1.id, dep2.id] })
      )
      await expect(areDependenciesMet(job, adapter)).resolves.toBeFalsy()
    })

    it("should return false when dependency failed", async () => {
      const dep = await adapter.addJob(makeJob({ name: "dep" }))
      await adapter.updateJobStatus(dep.id, { status: "failed" })

      const job = await adapter.addJob(makeJob({ dependsOn: [dep.id] }))
      await expect(areDependenciesMet(job, adapter)).resolves.toBeFalsy()
    })
  })
})
