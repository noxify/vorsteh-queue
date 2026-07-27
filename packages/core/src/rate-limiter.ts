/**
 * Token-bucket rate limiter for per-handler rate limiting.
 *
 * When a handler has `rateLimit: { max, duration }`, only `max` jobs
 * can be processed within each `duration` window. Excess jobs are
 * delayed (not rejected) until a token becomes available.
 *
 * @example
 * ```typescript
 * worker.register("send-sms", handler, {
 *   rateLimit: { max: 10, duration: 1000 }, // 10 per second
 * })
 * ```
 */

/* eslint-disable max-classes-per-file */

// eslint-disable-next-line max-classes-per-file
export interface RateLimitConfig {
  /** Maximum number of tokens (jobs) in the window */
  readonly max: number
  /** Window duration in milliseconds */
  readonly duration: number
}

/**
 * Sliding window rate limiter using token bucket algorithm.
 */
export class RateLimiter {
  private readonly tokens: number[] = []
  private readonly max: number
  private readonly duration: number

  constructor(config: RateLimitConfig) {
    this.max = config.max
    this.duration = config.duration
  }

  /**
   * Try to consume a token. Returns true if allowed, false if rate-limited.
   */
  tryConsume(): boolean {
    const now = Date.now()
    this.pruneExpired(now)

    if (this.tokens.length >= this.max) {
      return false
    }

    this.tokens.push(now)
    return true
  }

  /**
   * Get the time in ms until the next token becomes available.
   * Returns 0 if a token is available now.
   */
  getWaitTime(): number {
    const now = Date.now()
    this.pruneExpired(now)

    if (this.tokens.length < this.max) {
      return 0
    }

    // Oldest token will expire first
    const [oldest] = this.tokens
    if (oldest === undefined) {
      return 0
    }

    return Math.max(0, oldest + this.duration - now)
  }

  /**
   * Get current available tokens count.
   */
  get available(): number {
    this.pruneExpired(Date.now())
    return this.max - this.tokens.length
  }

  private pruneExpired(now: number): void {
    const cutoff = now - this.duration
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    while (this.tokens.length > 0 && this.tokens[0]! < cutoff) {
      this.tokens.shift()
    }
  }
}

/**
 * Manages rate limiters for multiple handlers.
 */
export class RateLimiterRegistry {
  private readonly limiters = new Map<string, RateLimiter>()

  /**
   * Register a rate limiter for a handler.
   *
   * @param handlerName - Name of the handler
   * @param config - Rate limit configuration
   */
  register(handlerName: string, config: RateLimitConfig): void {
    this.limiters.set(handlerName, new RateLimiter(config))
  }

  /**
   * Check if a handler is rate-limited.
   *
   * @param handlerName - Name of the handler
   * @returns true if the handler can process a job now
   */
  canProcess(handlerName: string): boolean {
    const limiter = this.limiters.get(handlerName)
    if (!limiter) {
      return true
    }
    return limiter.tryConsume()
  }

  /**
   * Get wait time for a handler.
   *
   * @param handlerName - Name of the handler
   * @returns Time in ms until handler can process next job (0 if ready)
   */
  getWaitTime(handlerName: string): number {
    const limiter = this.limiters.get(handlerName)
    if (!limiter) {
      return 0
    }
    return limiter.getWaitTime()
  }

  /**
   * Check if a handler has a rate limiter configured.
   */
  has(handlerName: string): boolean {
    return this.limiters.has(handlerName)
  }
}
