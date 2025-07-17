import { TZDate } from "@date-fns/tz"
import { Cron } from "croner"
import { addMilliseconds } from "date-fns"

/**
 * Parse cron expression with timezone support
 * @param cronExpression - Cron expression string
 * @param timezone - Target timezone (default: UTC)
 * @param from - Reference date (default: current time)
 * @returns Next run date in UTC
 */
export const parseCron = (
  cronExpression: string,
  timezone = "UTC",
  from: Date = new Date(),
): Date => {
  // Create TZDate in target timezone for accurate cron calculation
  const tzFrom = new TZDate(from, timezone)

  const cron = new Cron(cronExpression)
  const nextRun = cron.nextRun(tzFrom)

  if (!nextRun) {
    throw new Error(`Invalid cron expression: ${cronExpression}`)
  }

  // Convert to UTC Date for consistent storage
  return new Date(nextRun.getTime())
}

/**
 * Calculate next run time for recurring jobs with timezone support
 * @param options - Job scheduling options
 * @returns Next run date in UTC
 */
export const calculateNextRun = (options: {
  cron?: string
  repeatEvery?: number
  timezone?: string
  lastRun?: Date
}): Date => {
  const { cron, repeatEvery, timezone = "UTC", lastRun = new Date() } = options

  if (cron) {
    return parseCron(cron, timezone, lastRun)
  }

  if (repeatEvery) {
    // For interval-based repetition, use TZDate to handle DST properly
    const tzLastRun = new TZDate(lastRun, timezone)
    const nextRun = addMilliseconds(tzLastRun, repeatEvery)
    return new Date(nextRun.getTime())
  }

  throw new Error("Either cron or repeatEvery must be provided")
}

/**
 * Convert a date to UTC ensuring consistent storage
 * @param date - Date to convert
 * @param timezone - Source timezone (default: UTC)
 * @returns UTC date
 */
export const toUtcDate = (date: Date, timezone = "UTC"): Date => {
  if (timezone === "UTC") return date

  // Create TZDate and convert to UTC
  const tzDate = new TZDate(date, timezone)
  return new Date(tzDate.getTime())
}

/**
 * Get current time in UTC
 * @returns Current UTC date
 */
export const nowUtc = (): Date => {
  const tzDate = new TZDate(new Date(), "UTC")
  return new Date(tzDate.getTime())
}
