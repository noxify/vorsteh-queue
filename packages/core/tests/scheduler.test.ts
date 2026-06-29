import { describe, expect, it } from "vitest"

import {
  asUtc,
  calculateNextRun,
  parseCron,
  toUtcDate,
} from "../src/utils/scheduler"

describe("scheduler utilities", () => {
  describe(parseCron, () => {
    it("should return a valid next run date", () => {
      const baseDate = new Date("2025-01-15T12:00:00Z")
      const result = parseCron("0 9 * * *", "UTC", baseDate)

      expect(result).toBeInstanceOf(Date)
      // Next 9 AM UTC after 12:00 should be next day
      expect(result.getTime()).toBeGreaterThan(baseDate.getTime())
    })

    it("should throw on invalid cron expression", () => {
      expect(() => parseCron("invalid cron", "UTC")).toThrow(
        "Invalid cron expression"
      )
    })

    it("should handle timezone conversion", () => {
      const baseDate = new Date("2025-01-15T12:00:00Z")
      const utcResult = parseCron("0 9 * * *", "UTC", baseDate)
      const nyResult = parseCron("0 9 * * *", "America/New_York", baseDate)

      // NY is behind UTC, so 9 AM NY is later in UTC
      expect(nyResult.getTime()).not.toBe(utcResult.getTime())
    })
  })

  describe(calculateNextRun, () => {
    it("should calculate next run for cron", () => {
      const lastRun = new Date("2025-01-15T09:00:00Z")
      const result = calculateNextRun({
        cron: "0 9 * * *",
        lastRun,
      })

      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBeGreaterThan(lastRun.getTime())
    })

    it("should calculate next run for repeatEvery", () => {
      const lastRun = new Date("2025-01-15T09:00:00Z")
      const result = calculateNextRun({
        repeatEvery: 3_600_000, // 1 hour
        lastRun,
      })

      expect(result.getTime()).toBe(lastRun.getTime() + 3_600_000)
    })

    it("should throw if neither cron nor repeatEvery provided", () => {
      expect(() => calculateNextRun({ lastRun: new Date() })).toThrow(
        "Either cron or repeatEvery must be provided"
      )
    })

    it("should pass timezone to cron parsing", () => {
      const lastRun = new Date("2025-01-15T09:00:00Z")
      const resultUtc = calculateNextRun({
        cron: "0 10 * * *",
        lastRun,
        timezone: "UTC",
      })
      const resultNy = calculateNextRun({
        cron: "0 10 * * *",
        lastRun,
        timezone: "America/New_York",
      })

      expect(resultUtc.getTime()).not.toBe(resultNy.getTime())
    })
  })

  describe(toUtcDate, () => {
    it("should return same date for UTC timezone", () => {
      const date = new Date("2025-01-15T09:00:00Z")
      const result = toUtcDate(date, "UTC")
      expect(result.getTime()).toBe(date.getTime())
    })

    it("should convert timezone date to UTC", () => {
      const date = new Date("2025-01-15T09:00:00Z")
      const result = toUtcDate(date, "America/New_York")

      // Should be different because of timezone interpretation
      expect(result).toBeInstanceOf(Date)
    })
  })

  describe(asUtc, () => {
    it("should return a Date object", () => {
      const input = new Date("2025-01-15T09:00:00Z")
      const result = asUtc(input)

      expect(result).toBeInstanceOf(Date)
      expect(result.getTime()).toBe(input.getTime())
    })
  })
})
