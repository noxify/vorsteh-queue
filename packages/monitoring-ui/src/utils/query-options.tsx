import type { QueueDetails, QueueOverview } from "@/types"
import { queryOptions } from "@tanstack/react-query"
import axios from "redaxios"

import type { BaseJob } from "@vorsteh-queue/core"

export const DEPLOY_URL = "http://localhost:3000"

export const queuesQueryOptions = () =>
  queryOptions({
    queryKey: ["queues"],
    queryFn: () =>
      axios
        .get<QueueDetails[]>(DEPLOY_URL + "/api/queues")
        .then((r) => r.data)
        .catch(() => {
          throw new Error("Failed to fetch queues")
        }),
  })

export const queueQueryOptions = (
  queue: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) =>
  queryOptions({
    queryKey: ["queue", queue],
    queryFn: () =>
      axios
        .get<QueueDetails>(DEPLOY_URL + "/api/queues/" + queue)
        .then((r) => r.data)
        .catch(() => {
          throw new Error("Failed to fetch queue " + queue)
        }),
    ...(options ?? {}),
  })

export const queueJobsQueryOptions = (
  queue: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) =>
  queryOptions({
    queryKey: ["queue", queue, "jobs"],
    queryFn: () =>
      axios
        .get<BaseJob[]>(DEPLOY_URL + "/api/queues/" + queue + "/jobs")
        .then((r) => r.data)
        .catch(() => {
          throw new Error("Failed to fetch queue jobs " + queue)
        }),
    ...(options ?? {}),
  })

export const overviewQueryOptions = (options?: {
  enabled?: boolean
  refetchInterval?: number | false
}) =>
  queryOptions({
    queryKey: ["overview"],
    queryFn: () =>
      axios
        .get<QueueOverview>(DEPLOY_URL + "/api/overview")
        .then((r) => r.data)
        .catch(() => {
          throw new Error("Failed to fetch overview")
        }),
    ...(options ?? {}),
  })
