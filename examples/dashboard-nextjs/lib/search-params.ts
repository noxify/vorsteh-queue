import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server"

const jobStatuses = [
  "pending",
  "delayed",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "dead",
  "waiting-children",
] as const

export const jobsSearchParams = {
  status: parseAsStringLiteral(jobStatuses),
  name: parseAsString,
  page: parseAsInteger.withDefault(1),
}

export const jobsSearchParamsCache = createSearchParamsCache(jobsSearchParams)
