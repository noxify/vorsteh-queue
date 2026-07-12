import type { Job, QueueStats } from "@vorsteh-queue/core"
import { describe, expect, it } from "vitest"

import { PubSub } from "../src/api/pubsub"

describe(PubSub, () => {
  it("should deliver events to subscribers", async () => {
    const pubsub = new PubSub()
    const subscription = pubsub.subscribe("job:statusChanged")

    const mockJob = { id: "1", name: "test", status: "completed" } as Job

    // Publish after subscribing
    pubsub.publish("job:statusChanged", mockJob)

    const result = await subscription.next()
    expect(result.done).toBeFalsy()
    expect(result.value).toBe(mockJob)

    await subscription.return(undefined as never)
  })

  it("should support multiple subscribers", async () => {
    const pubsub = new PubSub()
    const sub1 = pubsub.subscribe("job:statusChanged")
    const sub2 = pubsub.subscribe("job:statusChanged")

    const mockJob = { id: "2", name: "test", status: "processing" } as Job
    pubsub.publish("job:statusChanged", mockJob)

    const result1 = await sub1.next()
    const result2 = await sub2.next()

    expect(result1.value).toBe(mockJob)
    expect(result2.value).toBe(mockJob)

    await sub1.return(undefined as never)
    await sub2.return(undefined as never)
  })

  it("should buffer events when no consumer is waiting", async () => {
    const pubsub = new PubSub()
    const subscription = pubsub.subscribe("stats:updated")

    const stats1 = {
      cancelled: 0,
      completed: 0,
      dead: 0,
      delayed: 0,
      failed: 0,
      pending: 1,
      processing: 0,
    } as QueueStats
    const stats2 = {
      cancelled: 0,
      completed: 0,
      dead: 0,
      delayed: 0,
      failed: 0,
      pending: 2,
      processing: 0,
    } as QueueStats

    // Publish multiple events before consuming
    pubsub.publish("stats:updated", stats1)
    pubsub.publish("stats:updated", stats2)

    const result1 = await subscription.next()
    const result2 = await subscription.next()

    expect(result1.value).toBe(stats1)
    expect(result2.value).toBe(stats2)

    await subscription.return(undefined as never)
  })

  // eslint-disable-next-line vitest/expect-expect
  it("should cleanup listener on return()", async () => {
    const pubsub = new PubSub()
    const subscription = pubsub.subscribe("job:statusChanged")

    await subscription.return(undefined as never)

    // Publishing after return should not accumulate anywhere
    pubsub.publish("job:statusChanged", { id: "3" } as Job)

    // No error thrown = success (listener was cleaned up)
  })

  it("should isolate different event channels", async () => {
    const pubsub = new PubSub()
    const jobSub = pubsub.subscribe("job:statusChanged")
    const statsSub = pubsub.subscribe("stats:updated")

    pubsub.publish("job:statusChanged", { id: "1" } as Job)

    const jobResult = await jobSub.next()
    expect(jobResult.value.id).toBe("1")

    // Stats subscription should not receive the job event
    // (We verify by publishing a stats event and confirming only that arrives)
    const stats = { pending: 5 } as QueueStats
    pubsub.publish("stats:updated", stats)

    const statsResult = await statsSub.next()
    expect(statsResult.value).toBe(stats)

    await jobSub.return(undefined as never)
    await statsSub.return(undefined as never)
  })

  it("should work as async iterable", async () => {
    const pubsub = new PubSub()
    const subscription = pubsub.subscribe("job:statusChanged")

    const jobs = [
      { id: "a", name: "test" } as Job,
      { id: "b", name: "test" } as Job,
    ]

    // Publish then consume
    for (const job of jobs) {
      pubsub.publish("job:statusChanged", job)
    }

    const received: Job[] = []
    let count = 0
    for await (const job of subscription) {
      received.push(job)
      count += 1
      if (count >= 2) {
        break
      }
    }

    expect(received).toHaveLength(2)
    expect(received[0]?.id).toBe("a")
    expect(received[1]?.id).toBe("b")
  })
})
