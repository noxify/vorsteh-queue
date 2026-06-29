import { describe, expect, it } from "vitest"

import { RateLimiter, RateLimiterRegistry } from "../src/rate-limiter"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe(RateLimiter, () => {
  it("should allow requests within limit", () => {
    const limiter = new RateLimiter({ max: 3, duration: 1000 })

    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeFalsy() // 4th should fail
  })

  it("should replenish tokens after duration", async () => {
    const limiter = new RateLimiter({ max: 2, duration: 50 })

    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeTruthy()
    expect(limiter.tryConsume()).toBeFalsy()

    await wait(60)

    expect(limiter.tryConsume()).toBeTruthy()
  })

  it("should report available tokens", () => {
    const limiter = new RateLimiter({ max: 5, duration: 1000 })

    expect(limiter.available).toBe(5)
    limiter.tryConsume()
    expect(limiter.available).toBe(4)
  })

  it("should report wait time", () => {
    const limiter = new RateLimiter({ max: 1, duration: 100 })

    limiter.tryConsume()
    const waitTime = limiter.getWaitTime()

    expect(waitTime).toBeGreaterThan(0)
    expect(waitTime).toBeLessThanOrEqual(100)
  })

  it("should report 0 wait time when tokens available", () => {
    const limiter = new RateLimiter({ max: 5, duration: 1000 })

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
    registry.register("send-sms", { max: 2, duration: 1000 })

    expect(registry.canProcess("send-sms")).toBeTruthy()
    expect(registry.canProcess("send-sms")).toBeTruthy()
    expect(registry.canProcess("send-sms")).toBeFalsy()
  })

  it("should track handlers independently", () => {
    const registry = new RateLimiterRegistry()
    registry.register("sms", { max: 1, duration: 1000 })
    registry.register("email", { max: 1, duration: 1000 })

    expect(registry.canProcess("sms")).toBeTruthy()
    expect(registry.canProcess("email")).toBeTruthy()
    expect(registry.canProcess("sms")).toBeFalsy()
    expect(registry.canProcess("email")).toBeFalsy()
  })

  it("should report has()", () => {
    const registry = new RateLimiterRegistry()
    registry.register("limited", { max: 5, duration: 1000 })

    expect(registry.has("limited")).toBeTruthy()
    expect(registry.has("unlimited")).toBeFalsy()
  })
})
