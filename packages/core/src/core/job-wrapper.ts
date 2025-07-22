import type { BaseJob, JobWithProgress } from "../../types"
import type { Queue } from "./queue"

export function createJobWrapper<TJobPayload>(
  job: BaseJob<TJobPayload>,
  queue: Queue,
): JobWithProgress<TJobPayload> {
  return {
    ...job,
    /**
     * Updates the progress value of the job in the queue
     * @param value - The progress value to set (between 0 and 100)
     * @returns Promise that resolves when the progress is updated
     */
    updateProgress: async (value: number): Promise<void> => {
      await queue.updateJobProgress(job.id, value)
    },
  }
}
