import { describe, expect, it } from "vitest"

import { calculateRetryDelay, DEFAULT_RETRY_STRATEGY } from "../src/retry"

describe(calculateRetryDelay, () => {
  describe("exponential strategy", () => {
    it("should increase delay exponentially", () => {
      /* eslint-disable vitest/max-expects */
      const strategy = {
        type: "exponential" as const,
        delay: 1000,
        maxDelay: 60_000,
      }

      const delay0 = calculateRetryDelay(strategy, 0)
      const delay1 = calculateRetryDelay(strategy, 1)
      const delay2 = calculateRetryDelay(strategy, 2)

      // 1000 * 2^0 + jitter ≈ 1000-1100
      expect(delay0).toBeGreaterThanOrEqual(1000)
      expect(delay0).toBeLessThan(1200)

      // 1000 * 2^1 + jitter ≈ 2000-2100
      expect(delay1).toBeGreaterThanOrEqual(2000)
      expect(delay1).toBeLessThan(2200)

      // 1000 * 2^2 + jitter ≈ 4000-4100
      expect(delay2).toBeGreaterThanOrEqual(4000)
      expect(delay2).toBeLessThan(4200)
      /* eslint-enable vitest/max-expects */
    })

    it("should cap at maxDelay", () => {
      const strategy = {
        type: "exponential" as const,
        delay: 1000,
        maxDelay: 5000,
      }

      const delay = calculateRetryDelay(strategy, 10) // 1000 * 2^10 = 1_024_000 >> 5000
      expect(delay).toBeLessThanOrEqual(5000)
    })
  })

  describe("linear strategy", () => {
    it("should increase delay linearly", () => {
      /* eslint-disable vitest/max-expects */
      const strategy = {
        type: "linear" as const,
        delay: 1000,
        maxDelay: 10_000,
      }

      expect(calculateRetryDelay(strategy, 0)).toBe(1000) // 1000 * (0+1)
      expect(calculateRetryDelay(strategy, 1)).toBe(2000) // 1000 * (1+1)
      expect(calculateRetryDelay(strategy, 2)).toBe(3000) // 1000 * (2+1)
      expect(calculateRetryDelay(strategy, 4)).toBe(5000) // 1000 * (4+1)
      /* eslint-enable vitest/max-expects */
    })

    it("should cap at maxDelay", () => {
      const strategy = { type: "linear" as const, delay: 1000, maxDelay: 3000 }

      expect(calculateRetryDelay(strategy, 5)).toBe(3000)
      expect(calculateRetryDelay(strategy, 100)).toBe(3000)
    })
  })

  describe("fixed strategy", () => {
    it("should always return the same delay", () => {
      /* eslint-disable vitest/max-expects */
      const strategy = { type: "fixed" as const, delay: 2000, maxDelay: 10_000 }

      expect(calculateRetryDelay(strategy, 0)).toBe(2000)
      expect(calculateRetryDelay(strategy, 1)).toBe(2000)
      expect(calculateRetryDelay(strategy, 5)).toBe(2000)
      expect(calculateRetryDelay(strategy, 100)).toBe(2000)
      /* eslint-enable vitest/max-expects */
    })
  })

  describe("custom function", () => {
    // eslint-disable-next-line vitest/max-expects
    it("should use the provided function", () => {
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const customStrategy = (attempts: number) => attempts * 500

      expect(calculateRetryDelay(customStrategy, 0)).toBe(0)
      expect(calculateRetryDelay(customStrategy, 1)).toBe(500)
      expect(calculateRetryDelay(customStrategy, 3)).toBe(1500)
    })
  })

  describe("default retry strategy", () => {
    it("should be exponential with 1s base and 30s max", () => {
      expect(DEFAULT_RETRY_STRATEGY).toStrictEqual({
        type: "exponential",
        delay: 1000,
        maxDelay: 30_000,
      })
    })
  })
})
