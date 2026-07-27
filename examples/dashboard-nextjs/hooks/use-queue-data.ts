"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  FlowSummary,
  FlowTree,
  Job,
  JobStatus,
  QueueStats,
} from "@vorsteh-queue/core"

function buildParams(
  extra?: Record<string, string | number | null | undefined>
): string {
  const params = new URLSearchParams()
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== null && value !== undefined && value !== "") {
        params.set(key, String(value))
      }
    }
  }
  const str = params.toString()
  return str ? `?${str}` : ""
}

export function useStats(queue: string, initialData?: QueueStats) {
  return useQuery<QueueStats>({
    queryKey: ["stats", queue],
    queryFn: () =>
      fetch(`/api/stats${buildParams({ queue })}`).then((r) => r.json()),
    initialData,
    refetchInterval: 5000,
  })
}

export function useJobs(
  queue: string,
  options?: {
    status?: JobStatus
    name?: string
    limit?: number
    offset?: number
  },
  initialData?: readonly Job[]
) {
  return useQuery<readonly Job[]>({
    queryKey: ["jobs", queue, options],
    queryFn: () =>
      fetch(
        `/api/jobs${buildParams({
          queue,
          status: options?.status,
          name: options?.name,
          limit: options?.limit,
          offset: options?.offset,
        })}`
      ).then((r) => r.json()),
    initialData,
    refetchInterval: 10_000,
  })
}

export function useJob(queue: string, id: string, initialData?: Job) {
  return useQuery<Job>({
    queryKey: ["job", queue, id],
    queryFn: () =>
      fetch(`/api/jobs/${id}${buildParams({ queue })}`).then((r) => r.json()),
    initialData,
    refetchInterval: 5000,
  })
}

export function useDeadJobs(
  queue: string,
  options?: { limit?: number; offset?: number },
  initialData?: readonly Job[]
) {
  return useQuery<readonly Job[]>({
    queryKey: ["dead-jobs", queue, options],
    queryFn: () =>
      fetch(
        `/api/dlq${buildParams({ queue, limit: options?.limit, offset: options?.offset })}`
      ).then((r) => r.json()),
    initialData,
    refetchInterval: 10_000,
  })
}

export function useFlows(
  queue: string,
  options?: { limit?: number; offset?: number },
  initialData?: readonly FlowSummary[]
) {
  return useQuery<readonly FlowSummary[]>({
    queryKey: ["flows", queue, options],
    queryFn: () =>
      fetch(
        `/api/flows${buildParams({ queue, limit: options?.limit, offset: options?.offset })}`
      ).then((r) => r.json()),
    initialData,
    refetchInterval: 10_000,
  })
}

export function useFlowTree(
  queue: string,
  flowId: string,
  initialData?: FlowTree
) {
  return useQuery<FlowTree>({
    queryKey: ["flow-tree", queue, flowId],
    queryFn: () =>
      fetch(`/api/flows/${flowId}${buildParams({ queue })}`).then((r) =>
        r.json()
      ),
    initialData,
    refetchInterval: 5000,
  })
}
