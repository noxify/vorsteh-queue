/*
 * @skip-docs
 */
import { TZDate } from "@date-fns/tz"
import { Cron } from "croner"

/**
 * Parse a cron expression in a timezone and return the next execution time as UTC.
 * This is the core of our UTC-first approach - all timezone calculations happen here,
 * and the result is always a UTC timestamp for storage and processing.
 *
 * @param expression Cron expression (e.g., "0 9 * * *")
 * @param timezone IANA timezone (e.g. `America/New_York`)
 * @param baseDate Base date for calculation (defaults to current time)
 * @returns Next execution time as UTC Date
 *
 * @example
 * ```typescript
 * // 9 AM daily in New York timezone -> returns UTC timestamp
 * const nextRun = parseCron("0 9 * * *", "America/New_York")
 * // Result is always UTC, ready for database storage
 * ```
 */
export const parseCron = (
  expression: string,
  timezone = "UTC",
  baseDate: Date = new Date(),
): Date => {
  try {
    // Simple approach: use croner without timezone complications
    const cron = new Cron(expression, { timezone })
    const nextRun = cron.nextRun(baseDate)

    if (!nextRun) {
      throw new Error(`No next run found for cron: ${expression}`)
    }

    // For UTC-first approach, we assume the cron runs in the specified timezone
    // and convert the result to UTC if needed
    if (timezone !== "UTC") {
      // Apply timezone offset to the result
      // This is a simplified approach for the UTC-first implementation
      const tzDate = new TZDate(nextRun, timezone)
      return new Date(tzDate.getTime())
    }

    // Always return UTC Date - no timezone info stored
    return new TZDate(nextRun.getTime(), "UTC")
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    throw new Error(`Invalid cron expression: ${expression}`)
  }
}

/**
 * Calculate the next run time for a job - always returns UTC.
 * For cron jobs, timezone conversion happens here and result is UTC.
 * For intervals, timezone is irrelevant (just add milliseconds).
 *
 * @param options Configuration object
 * @returns Next execution time as UTC Date
 *
 * @example
 * ```typescript
 * // Cron: timezone conversion happens here, result is UTC
 * const nextRun = calculateNextRun({
 *   cron: "0 9 * * *",
 *   timezone: "America/New_York",
 *   lastRun: new Date()
 * })
 *
 * // Interval: timezone irrelevant, just add milliseconds
 * const nextRun = calculateNextRun({
 *   repeatEvery: 3600000,
 *   lastRun: new Date()
 * })
 * ```
 */
export const calculateNextRun = (options: {
  cron?: string
  repeatEvery?: number
  timezone?: string
  lastRun: Date
}): Date => {
  const { cron, repeatEvery, timezone = "UTC", lastRun } = options

  if (cron) {
    // Timezone conversion happens in parseCron, result is UTC
    return parseCron(cron, timezone, lastRun)
  }

  if (repeatEvery) {
    // Intervals are timezone-agnostic - just add milliseconds
    return new Date(lastRun.getTime() + repeatEvery)
  }

  throw new Error("Either cron or repeatEvery must be provided")
}

/**
 * Convert a local date to UTC by interpreting it in a specific timezone.
 * Used when users provide local times that need timezone context.
 *
 * @param date  Input date to convert
 * @param timezone IANA timezone to interpret the date in
 * @returns UTC Date
 *
 * @example
 * ```typescript
 * // User says "run at 9 AM" in New York - convert to UTC for storage
 * const utcDate = toUtcDate(new Date("2024-01-15T09:00:00"), "America/New_York")
 * ```
 */
export const toUtcDate = (date: Date, timezone = "UTC"): Date => {
  if (timezone === "UTC") return date

  // Create a TZDate in the specified timezone and return as UTC
  const tzDate = new TZDate(date, timezone)
  // Return the UTC equivalent
  return new Date(tzDate.getTime())
}

/**
 * Create a UTC Date object.
 *
 * @param input Input date to convert
 * @returns UTC Date
 *
 * @example
 * ```typescript
 * // Create a UTC Date object
 * const utcDate = asUtc(new Date("2024-01-15T09:00:00"))
 * ```
 */
export function asUtc(input: Date) {
  return new TZDate(input, "UTC")
}
