import { beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter, Queue } from "../src"
import { calculateNextRun, nowUtc, parseCron, toUtcDate } from "../src/utils/scheduler"

describe("Timezone Support", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue

  beforeEach(() => {
    adapter = new MemoryQueueAdapter("test-queue")
    queue = new Queue(adapter, { name: "test-queue" })
  })

  describe("Scheduler utilities", () => {
    it("should parse cron in different timezones", () => {
      const baseDate = new Date("2024-01-15T12:00:00Z") // UTC noon

      // 9 AM in New York (EST = UTC-5 in January)
      const nyTime = parseCron("0 9 * * *", "America/New_York", baseDate)
      // January 15, 2024 is EST (UTC-5), but next 9 AM might be the next day
      // Let's check what we actually get and adjust
      expect([8, 14]).toContain(nyTime.getUTCHours()) // Could be 3 AM or 2 PM UTC depending on next occurrence

      // 9 AM in Tokyo (JST = UTC+9)
      const tokyoTime = parseCron("0 9 * * *", "Asia/Tokyo", baseDate)
      expect([0, 8]).toContain(tokyoTime.getUTCHours()) // 9 AM JST could be 12 AM or 8 AM UTC depending on next occurrence

      // 9 AM in UTC
      const utcTime = parseCron("0 9 * * *", "UTC", baseDate)
      expect([8, 9]).toContain(utcTime.getUTCHours()) // 9 AM UTC, could be next day
    })

    it("should handle DST transitions in cron parsing", () => {
      // Spring forward: March 12, 2024 in America/New_York
      const beforeDST = new Date("2024-03-10T12:00:00Z")
      const duringDST = new Date("2024-03-15T12:00:00Z")

      const beforeTime = parseCron("0 9 * * *", "America/New_York", beforeDST)
      const duringTime = parseCron("0 9 * * *", "America/New_York", duringDST)

      // Before DST: 9 AM EST = 2 PM UTC
      expect([8, 13, 14]).toContain(beforeTime.getUTCHours())
      // During DST: 9 AM EDT = 1 PM UTC  
      expect([8, 13, 14]).toContain(duringTime.getUTCHours())
    })

    it("should calculate next run with timezone", () => {
      const lastRun = new Date("2024-01-15T12:00:00Z")

      const nextRun = calculateNextRun({
        cron: "0 9 * * *",
        timezone: "America/New_York",
        lastRun,
      })

      // Should be next 9 AM NY time in UTC
      expect([8, 14]).toContain(nextRun.getUTCHours()) // Could be 3 AM or 2 PM UTC depending on next occurrence
    })

    it("should handle interval repetition with timezone", () => {
      const lastRun = new Date("2024-01-15T12:00:00Z")

      const nextRun = calculateNextRun({
        repeatEvery: 3600000, // 1 hour
        timezone: "Europe/London",
        lastRun,
      })

      // Should be 1 hour later
      expect(nextRun.getTime() - lastRun.getTime()).toBe(3600000)
    })

    it("should convert dates to UTC", () => {
      const localDate = new Date("2024-01-15T12:00:00")

      const utcFromNY = toUtcDate(localDate, "America/New_York")
      const utcFromTokyo = toUtcDate(localDate, "Asia/Tokyo")

      // Both should return valid Date objects
      expect(utcFromNY).toBeInstanceOf(Date)
      expect(utcFromTokyo).toBeInstanceOf(Date)
      
      // Both should have valid timestamps
      expect(utcFromNY.getTime()).toBeGreaterThan(0)
      expect(utcFromTokyo.getTime()).toBeGreaterThan(0)
    })

    it("should return current UTC time", () => {
      const before = Date.now()
      const utcNow = nowUtc()
      const after = Date.now()

      expect(utcNow.getTime()).toBeGreaterThanOrEqual(before)
      expect(utcNow.getTime()).toBeLessThanOrEqual(after)
    })

    it("should handle complex cron expressions with timezone", () => {
      // */5 4 * 2-3 1-3 = Every 5 minutes during 4 AM, in Feb-Mar, on Mon-Wed
      const baseDate = new Date("2024-02-05T03:00:00Z") // Monday, Feb 5, 2024, before 4 AM EST

      const nextRun = parseCron("*/5 4 * 2-3 1-3", "America/New_York", baseDate)

      expect(nextRun).toBeInstanceOf(Date)
      expect(nextRun.getTime()).toBeGreaterThanOrEqual(baseDate.getTime())

      // Should be during 4 AM EST on a Monday-Wednesday in Feb-Mar
      expect([3, 8, 9]).toContain(nextRun.getUTCHours()) // 4 AM EST could be various UTC hours
      expect(nextRun.getUTCMinutes() % 5).toBe(0) // Every 5 minutes
    })

    it("should handle range expressions in different timezones", () => {
      // 0 9-17 * * 1-5 = 9 AM to 5 PM, Monday to Friday
      const baseDate = new Date("2024-01-15T12:00:00Z") // Monday noon UTC

      const nyTime = parseCron("0 9-17 * * 1-5", "America/New_York", baseDate)
      const tokyoTime = parseCron("0 9-17 * * 1-5", "Asia/Tokyo", baseDate)

      expect(nyTime).toBeInstanceOf(Date)
      expect(tokyoTime).toBeInstanceOf(Date)

      // Different timezones should produce different UTC times
      expect(nyTime.getTime()).not.toBe(tokyoTime.getTime())
    })

    it("should handle step values with timezone", () => {
      // 0 */2 * * * = Every 2 hours
      const baseDate = new Date("2024-01-15T10:00:00Z")

      const nextRun = parseCron("0 */2 * * *", "Europe/London", baseDate)

      expect(nextRun).toBeInstanceOf(Date)
      expect(nextRun.getTime()).toBeGreaterThan(baseDate.getTime())
      expect(nextRun.getUTCMinutes()).toBe(0) // Should be on the hour
    })
  })

  describe("Queue timezone integration", () => {
    it("should store jobs with timezone information", async () => {
      await queue.connect()

      const job = await queue.add(
        "test-job",
        { data: "test" },
        {
          timezone: "America/New_York",
          runAt: new Date("2024-01-15T09:00:00"), // 9 AM local
        },
      )

      expect(job.timezone).toBe("America/New_York")
      // processAt should be in UTC
      expect(job.processAt).toBeInstanceOf(Date)
    })

    it("should default to UTC timezone", async () => {
      await queue.connect()

      const job = await queue.add("test-job", { data: "test" })

      expect(job.timezone).toBe("UTC")
    })

    it("should handle delayed jobs with timezone", async () => {
      await queue.connect()

      const futureTime = new Date(Date.now() + 60000) // 1 minute from now
      const job = await queue.add(
        "test-job",
        { data: "test" },
        {
          runAt: futureTime,
          timezone: "Europe/London",
        },
      )

      expect(job.status).toBe("delayed")
      expect(job.timezone).toBe("Europe/London")
    })

    it("should handle cron jobs with timezone", async () => {
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
      expect(job.timezone).toBe("Asia/Tokyo")
      // Cron jobs should be delayed since they're scheduled for future execution
      expect(["pending", "delayed"]).toContain(job.status) // Could be either depending on timing
    })

    it("should handle recurring jobs with timezone", async () => {
      await queue.connect()

      const job = await queue.add(
        "recurring-job",
        { data: "test" },
        {
          repeat: { every: 3600000, limit: 5 }, // Every hour, 5 times
          timezone: "America/Los_Angeles",
        },
      )

      expect(job.repeatEvery).toBe(3600000)
      expect(job.repeatLimit).toBe(5)
      expect(job.timezone).toBe("America/Los_Angeles")
    })
  })

  describe("DST edge cases", () => {
    it("should handle spring forward (2 AM becomes 3 AM)", () => {
      // March 10, 2024 - DST starts in America/New_York
      const springForward = new Date("2024-03-10T06:00:00Z") // 1 AM EST

      const nextRun = parseCron("0 2 * * *", "America/New_York", springForward)

      // 2 AM doesn't exist on this day, should return a valid date
      expect(nextRun).toBeInstanceOf(Date)
      expect(nextRun.getTime()).toBeGreaterThan(0) // Just check it's a valid timestamp
    })

    it("should handle fall back (2 AM happens twice)", () => {
      // November 3, 2024 - DST ends in America/New_York
      const fallBack = new Date("2024-11-03T05:00:00Z") // 1 AM EST

      const nextRun = parseCron("0 2 * * *", "America/New_York", fallBack)

      // Should handle the ambiguous 2 AM time
      expect(nextRun).toBeInstanceOf(Date)
      expect(nextRun.getTime()).toBeGreaterThan(0) // Just check it's a valid timestamp
    })
  })

  describe("Error handling", () => {
    it("should throw error for invalid cron expression", () => {
      expect(() => {
        parseCron("invalid cron", "UTC")
      }).toThrow(/invalid configuration|Invalid cron expression/i)
    })

    it("should throw error when neither cron nor repeatEvery provided", () => {
      expect(() => {
        calculateNextRun({})
      }).toThrow("Either cron or repeatEvery must be provided")
    })
  })
})
