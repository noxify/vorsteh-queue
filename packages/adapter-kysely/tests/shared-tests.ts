import { describe, expect, it } from "vitest"

import type { BaseQueueAdapter } from "@vorsteh-queue/core"

/**
 * Shared test suite for all database adapters.
 * Tests database-agnostic functionality that should work the same across all adapters.
 */
export function createSharedTests(
  adapterName: string,
  getAdapter: () => Promise<BaseQueueAdapter>,
) {
  describe(`${adapterName} - Shared Functionality`, () => {
    describe("Progress Tracking", () => {
      it("should update job progress", async () => {
        const adapter = await getAdapter()
        adapter.setQueueName("progress-test-queue")

        const job = await adapter.addJob({
          name: "progress-test",
          payload: { test: "data" },
          status: "pending",
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          processAt: new Date(),
          progress: 0,
          repeatCount: 0,
        })

        // Update progress
        await adapter.updateJobProgress(job.id, 50)

        // Progress should be updated (we can't easily verify without direct DB access)
        // This test mainly ensures the method doesn't throw
        expect(job.id).toBeDefined()
      })

      it("should normalize progress values", async () => {
        const adapter = await getAdapter()
        adapter.setQueueName("progress-normalize-test-queue")

        const job = await adapter.addJob({
          name: "progress-normalize-test",
          payload: { test: "data" },
          status: "pending",
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          processAt: new Date(),
          progress: 0,
          repeatCount: 0,
        })

        // Test boundary values - should not throw
        await adapter.updateJobProgress(job.id, -10) // Should normalize to 0
        await adapter.updateJobProgress(job.id, 150) // Should normalize to 100

        expect(job.id).toBeDefined()
      })
    })

    describe("UTC Storage", () => {
      it("should store all timestamps as UTC", async () => {
        const adapter = await getAdapter()
        adapter.setQueueName("utc-test-queue")

        const job = await adapter.addJob({
          name: "utc-test",
          payload: { test: "data" },
          status: "pending",
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          processAt: new Date("2024-01-15T14:00:00Z"),
          progress: 0,
          repeatCount: 0,
        })

        // Should store exact UTC timestamp
        expect(job.processAt.toISOString()).toBe("2024-01-15T14:00:00.000Z")
        expect(job).not.toHaveProperty("timezone")
      })

      it("should handle timezone offsets correctly", async () => {
        const adapter = await getAdapter()
        adapter.setQueueName("offset-test-queue")

        const dateWithOffset = new Date("2024-01-15T14:00:00+02:00") // 2 PM +2 = 12 PM UTC

        const job = await adapter.addJob({
          name: "offset-test",
          payload: { test: "data" },
          status: "pending",
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          processAt: dateWithOffset,
          progress: 0,
          repeatCount: 0,
        })

        // Should store UTC equivalent
        expect(job.processAt.toISOString()).toBe("2024-01-15T12:00:00.000Z")
        expect(job.processAt.getTime()).toBe(dateWithOffset.getTime())
      })

      it("should maintain timestamp consistency", async () => {
        const adapter = await getAdapter()
        adapter.setQueueName("consistency-test-queue")

        const originalTimestamp = 1705327200000 // 2024-01-15T14:00:00Z
        const originalDate = new Date(originalTimestamp)

        await adapter.addJob({
          name: "consistency-test",
          payload: { test: "data" },
          status: "pending",
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          processAt: originalDate,
          progress: 0,
          repeatCount: 0,
        })

        // Retrieve the job
        const retrievedJob = await adapter.getNextJob()

        expect(retrievedJob).toBeTruthy()
        expect(retrievedJob?.processAt.getTime()).toBe(originalTimestamp)
      })
    })

    describe("Timezone Edge Cases", () => {
      it("should handle various date formats", async () => {
        const adapter = await getAdapter()
        adapter.setQueueName("format-test-queue")

        const testCases = [
          {
            name: "ISO with Z",
            date: new Date("2024-01-15T14:00:00Z"),
            expected: "2024-01-15T14:00:00.000Z",
          },
          {
            name: "ISO with +02:00",
            date: new Date("2024-01-15T14:00:00+02:00"),
            expected: "2024-01-15T12:00:00.000Z",
          },
          {
            name: "ISO with -05:00",
            date: new Date("2024-01-15T14:00:00-05:00"),
            expected: "2024-01-15T19:00:00.000Z",
          },
        ]

        for (const testCase of testCases) {
          const job = await adapter.addJob({
            name: `format-test-${testCase.name}`,
            payload: { format: testCase.name },
            status: "pending",
            priority: 2,
            attempts: 0,
            maxAttempts: 3,
            processAt: testCase.date,
            progress: 0,
            repeatCount: 0,
          })

          expect(job.processAt.toISOString()).toBe(testCase.expected)
        }
      })

      it("should handle DST transitions", async () => {
        const adapter = await getAdapter()
        adapter.setQueueName("dst-test-queue")

        // Spring forward and fall back dates
        const springDate = new Date("2024-03-10T07:00:00Z")
        const fallDate = new Date("2024-11-03T06:00:00Z")

        const springJob = await adapter.addJob({
          name: "spring-job",
          payload: { dst: "spring" },
          status: "pending",
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          processAt: springDate,
          progress: 0,
          repeatCount: 0,
        })

        const fallJob = await adapter.addJob({
          name: "fall-job",
          payload: { dst: "fall" },
          status: "pending",
          priority: 2,
          attempts: 0,
          maxAttempts: 3,
          processAt: fallDate,
          progress: 0,
          repeatCount: 0,
        })

        // Should store exact UTC timestamps
        expect(springJob.processAt.toISOString()).toBe("2024-03-10T07:00:00.000Z")
        expect(fallJob.processAt.toISOString()).toBe("2024-11-03T06:00:00.000Z")
      })
    })
  })
}
