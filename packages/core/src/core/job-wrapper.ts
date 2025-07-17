import type { BaseJob, JobWithProgress } from "../types"
import type { Queue } from "./queue"

export function createJobWrapper<TJobPayload>(
  job: BaseJob<TJobPayload>,
  queue: Queue,
): JobWithProgress<TJobPayload> {
  return {
    ...job,
    updateProgress: async (value: number): Promise<void> => {
      await queue.updateJobProgress(job.id, value)
    },
  }
}
