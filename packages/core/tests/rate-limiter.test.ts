import { describe, expect, it } from "vitest"

import { RateLimiter, RateLimiterRegistry } from "../src/rate-limiter"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe(RateLimiter, () => {
  it("should allow requests within limit", () => {
    const limiter = new RateLimiter({ duration: 1000, max: 3 })

    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeFalsy() // 4th should fail
  })

  it("should replenish tokens after duration", async () => {
    const limiter = new RateLimiter({ duration: 50, max: 2 })

    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeFalsy()

    await wait(60)

    expect(limiter.tryConsume()).toBeTruthy()
  })

  it("should report available tokens", () => {
    const limiter = new RateLimiter({ duration: 1000, max: 5 })

    expect(limiter.available).toBe(5)
    limiter.tryConsume()
    expect(limiter.available).toBe(4)
  })

  it("should report wait time", () => {
    const limiter = new RateLimiter({ duration: 100, max: 1 })

    limiter.tryConsume()
    const waitTime = limiter.getWaitTime()

    expect(waitTime).toBeGreaterThan(0)
    expect(waitTime).toBeLessThanOrEqual(100)
  })

  it("should report 0 wait time when tokens available", () => {
    const limiter = new RateLimiter({ duration: 1000, max: 5 })

    expect(limiter.getWaitTime()).toBe(0)
  })
})

describe(RateLimiterRegistry, () => {
  it("should allow unregistered handlers", () => {
    const registry = new RateLimiterRegistry()
    expect(registry.canProcess("unknown")).toBeTruthy()
  })

  it("should enforce rate limits for registered handlers", () => {
    const registry = new RateLimiterRegistry()
    registry.register("send-sms", { duration: 1000, max: 2 })

    expect(registry.canProcess("send-sms")).toBeTruthy()
    expect(registry.canProcess("send-sms")).toBeTruthy()
    expect(registry.canProcess("send-sms")).toBeFalsy()
  })

  it("should track handlers independently", () => {
    const registry = new RateLimiterRegistry()
    registry.register("sms", { duration: 1000, max: 1 })
    registry.register("email", { duration: 1000, max: 1 })

    expect(registry.canProcess("sms")).toBeTruthy()
    expect(registry.canProcess("email")).toBeTruthy()
    expect(registry.canProcess("sms")).toBeFalsy()
    expect(registry.canProcess("email")).toBeFalsy()
  })

  it("should report has()", () => {
    const registry = new RateLimiterRegistry()
    registry.register("limited", { duration: 1000, max: 5 })

    expect(registry.has("limited")).toBeTruthy()
    expect(registry.has("unlimited")).toBeFalsy()
  })
})
