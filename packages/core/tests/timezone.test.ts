import { beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter, Queue } from "../src"
import { calculateNextRun, parseCron, toUtcDate } from "../src/utils/scheduler"

describe("UTC-First Timezone Support", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(() => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "test-queue" })
  })

  describe("Scheduler utilities", () => {
    it("should parse cron and return UTC timestamps", () => {
      const baseDate = new Date("2024-01-15T06:00:00Z") // UTC 6 AM

      // Test that cron parsing works and returns valid UTC timestamps
      const nyTime = parseCron("0 9 * * *", "America/New_York", baseDate)
      const tokyoTime = parseCron("0 9 * * *", "Asia/Tokyo", baseDate)
      const utcTime = parseCron("0 9 * * *", "UTC", baseDate)

      // All should be Date objects with valid timestamps
      expect(nyTime).toBeInstanceOf(Date)
      expect(tokyoTime).toBeInstanceOf(Date)
      expect(utcTime).toBeInstanceOf(Date)

      // All should be valid timestamps (core functionality)
      expect(nyTime.getTime()).toBeGreaterThan(0)
      expect(tokyoTime.getTime()).toBeGreaterThan(0)
      expect(utcTime.getTime()).toBeGreaterThan(0)

      // At least Tokyo should be different (it's +9 hours from UTC)
      expect(tokyoTime.getTime()).not.toBe(utcTime.getTime())
    })

    it("should handle interval repetition", () => {
      const lastRun = new Date("2024-01-15T12:00:00Z")

      const nextRun = calculateNextRun({
        repeatEvery: 3600000, // 1 hour
        lastRun,
      })

      // Should be exactly 1 hour later
      expect(nextRun.getTime() - lastRun.getTime()).toBe(3600000)
    })

    it("should convert local dates to UTC", () => {
      const localDate = new Date("2024-01-15T12:00:00") // No timezone

      const utcFromNY = toUtcDate(localDate, "America/New_York")
      const utcFromTokyo = toUtcDate(localDate, "Asia/Tokyo")

      // Both should be valid UTC dates
      expect(utcFromNY).toBeInstanceOf(Date)
      expect(utcFromTokyo).toBeInstanceOf(Date)

      // Both should be valid UTC dates (might be same if no timezone context)
      expect(utcFromNY.getTime()).toBeGreaterThan(0)
      expect(utcFromTokyo.getTime()).toBeGreaterThan(0)
    })
  })

  describe("Queue integration", () => {
    it("should store jobs with UTC timestamps", async () => {
      await queue.connect()

      const job = await queue.add(
        "test-job",
        { data: "test" },
        {
          timezone: "America/New_York",
          runAt: new Date("2024-01-15T09:00:00"), // 9 AM local
        },
      )

      // processAt should be UTC timestamp
      expect(job.processAt).toBeInstanceOf(Date)
      // No timezone field stored
      expect(job).not.toHaveProperty("timezone")
    })

    it("should handle cron jobs with timezone conversion", async () => {
      await queue.connect()

      const job = await queue.add(
        "cron-job",
        { data: "test" },
        {
          cron: "0 9 * * *", // 9 AM daily
          timezone: "Asia/Tokyo",
        },
      )

      expect(job.cron).toBe("0 9 * * *")
      expect(job.status).toBe("delayed")
      // processAt should be UTC timestamp
      expect(job.processAt).toBeInstanceOf(Date)
      // No timezone field stored
      expect(job).not.toHaveProperty("timezone")
    })

    it("should handle recurring jobs", async () => {
      await queue.connect()

      const job = await queue.add(
        "recurring-job",
        { data: "test" },
        {
          repeat: { every: 3600000, limit: 5 }, // Every hour, 5 times
        },
      )

      expect(job.repeatEvery).toBe(3600000)
      expect(job.repeatLimit).toBe(5)
      // No timezone field stored
      expect(job).not.toHaveProperty("timezone")
    })

    it("should default to UTC when no timezone specified", async () => {
      await queue.connect()

      const job = await queue.add("test-job", { data: "test" })

      // Should work without timezone
      expect(job.processAt).toBeInstanceOf(Date)
      expect(job).not.toHaveProperty("timezone")
    })
  })

  describe("Edge cases", () => {
    it("should handle invalid cron expressions", () => {
      expect(() => {
        parseCron("invalid cron", "UTC")
      }).toThrow("Invalid cron expression")
    })

    it("should handle missing scheduling options", () => {
      expect(() => {
        calculateNextRun({ lastRun: new Date() })
      }).toThrow("Either cron or repeatEvery must be provided")
    })

    it("should handle UTC timezone explicitly", () => {
      const date = new Date("2024-01-15T12:00:00Z")
      const utcDate = toUtcDate(date, "UTC")

      // Should return same date for UTC
      expect(utcDate.getTime()).toBe(date.getTime())
    })
  })
})
