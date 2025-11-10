import type { QueueConfig, QueueStats } from "@vorsteh-queue/core"

export interface QueueOverview {
  queues: number
  pending: number
  processing: number
  completed: number
  failed: number
  delayed: number
  cancelled: number
}

export interface QueueDetails {
  config: QueueConfig
  stats: QueueStats
}

export type AvailableStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "delayed"
  | "cancelled"
