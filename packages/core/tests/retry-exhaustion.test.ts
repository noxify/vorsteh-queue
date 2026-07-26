import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import { Queue } from "../src/queue"
import type { Job, JobContext, JobWithProgress } from "../src/types"
import { Worker } from "../src/worker"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("retry exhaustion", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue
  let worker: Worker

  beforeEach(() => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "test" })
    worker = new Worker(adapter, {
      name: "test",
      concurrency: 1,
      pollInterval: 50,
      retryStrategy: { type: "fixed", delay: 100, maxDelay: 100 },
    })
  })

  afterEach(async () => {
    await worker.stop()
  })

  it("should move job to dead after maxAttempts are exhausted", async () => {
    worker.register("failing-job", async () => {
      throw new Error("always fails")
    })

    const job = await queue.add(
      "failing-job",
      { data: "test" },
      { maxAttempts: 3 }
    )
    worker.start()

    // Wait for all retries to process (3 attempts × ~100ms delay + processing)
    await wait(2000)

    const finalJob = await adapter.getJobById(job.id)
    expect(finalJob).not.toBeNull()
    expect(finalJob!.status).toBe("dead")
    expect(finalJob!.attempts).toBe(3)
  })

  it("should not increment attempts for step.sleep resumptions", async () => {
    let executionCount = 0

    worker.register(
      "step-sleep-job",
      async (_job: JobWithProgress, { step }: JobContext) => {
        executionCount += 1

        await step.run("work", async () => {
          return "done"
        })

        await step.sleep("pause", 50)

        await step.run("after-sleep", async () => {
          return "final"
        })

        return "completed"
      }
    )

    const job = await queue.add("step-sleep-job", {}, { maxAttempts: 2 })
    worker.start()

    // Wait for the job to complete through sleep cycle
    await wait(3000)

    const finalJob = await adapter.getJobById(job.id)
    expect(finalJob).not.toBeNull()
    // The job should complete successfully — attempts should be 1 (initial execution only)
    expect(finalJob!.status).toBe("completed")
    expect(finalJob!.attempts).toBe(1)
  })

  it("should move exhausted delayed jobs to dead during getNextJob promotion", async () => {
    // Manually inject a delayed job that has exhausted its attempts
    adapter.setQueueName("test")
    const job = await adapter.addJob({
      name: "test-job",
      payload: {},
      status: "delayed",
      priority: 2,
      attempts: 3,
      maxAttempts: 3,
      processAt: new Date(Date.now() - 1000), // already past due
      progress: 0,
      repeatCount: 0,
    })

    worker.register("test-job", async () => {
      return "should not run"
    })

    worker.start()
    await wait(500)

    const finalJob = await adapter.getJobById(job.id)
    expect(finalJob).not.toBeNull()
    expect(finalJob!.status).toBe("dead")
    expect(finalJob!.attempts).toBe(3)
  })

  it("should move flow child jobs to dead after maxAttempts", async () => {
    worker.register("parent-job", async () => {
      return "parent done"
    })

    worker.register("child-job", async () => {
      throw new Error("child always fails")
    })

    const flow = await queue.addFlow({
      name: "parent-job",
      payload: { type: "parent" },
      children: [
        {
          name: "child-job",
          payload: { type: "child" },
          options: { maxAttempts: 2 },
          failParentOnFailure: true,
        },
      ],
    })

    worker.start()

    // Wait for retries (2 attempts × 100ms delay + processing)
    await wait(3000)

    const allJobs = await adapter.getJobs({ limit: 100, offset: 0 })
    const childJob = allJobs.find(
      (j: Job) => j.name === "child-job" && j.flowId === flow.id
    )

    expect(childJob).not.toBeNull()
    expect(childJob!.status).toBe("dead")
    expect(childJob!.attempts).toBe(2)
  })
})
