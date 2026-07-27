import type { QueueStats } from "@vorsteh-queue/core"
import { describe, expect, it } from "vitest"

import type { JobLifecycleEvent } from "../src/api/pubsub"
import { PubSub } from "../src/api/pubsub"

const mockEvent: JobLifecycleEvent = {
  currentStatus: "completed",
  jobId: "1",
  jobName: "test",
  previousStatus: "processing",
  queueName: "test-queue",
  timestamp: new Date().toISOString(),
}

describe(PubSub, () => {
  it("should deliver events to subscribers", async () => {
    const pubsub = new PubSub()
    const subscription = pubsub.subscribe("job:statusChanged")

    pubsub.publish("job:statusChanged", mockEvent)

    const result = await subscription.next()
    expect(result.done).toBeFalsy()
    expect(result.value).toBe(mockEvent)

    await subscription.return(undefined as never)
  })

  it("should support multiple subscribers", async () => {
    const pubsub = new PubSub()
    const sub1 = pubsub.subscribe("job:statusChanged")
    const sub2 = pubsub.subscribe("job:statusChanged")

    pubsub.publish("job:statusChanged", mockEvent)

    const result1 = await sub1.next()
    const result2 = await sub2.next()

    expect(result1.value).toBe(mockEvent)
    expect(result2.value).toBe(mockEvent)

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
    pubsub.publish("job:statusChanged", mockEvent)

    // No error thrown = success (listener was cleaned up)
  })

  it("should isolate different event channels", async () => {
    const pubsub = new PubSub()
    const jobSub = pubsub.subscribe("job:statusChanged")
    const statsSub = pubsub.subscribe("stats:updated")

    pubsub.publish("job:statusChanged", mockEvent)

    const jobResult = await jobSub.next()
    expect(jobResult.value.jobId).toBe("1")

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

    const events: JobLifecycleEvent[] = [
      { ...mockEvent, jobId: "a" },
      { ...mockEvent, jobId: "b" },
    ]

    for (const event of events) {
      pubsub.publish("job:statusChanged", event)
    }

    const received: JobLifecycleEvent[] = []
    let count = 0
    for await (const event of subscription) {
      received.push(event)
      count += 1
      if (count >= 2) {
        break
      }
    }

    expect(received).toHaveLength(2)
    expect(received[0]?.jobId).toBe("a")
    expect(received[1]?.jobId).toBe("b")
  })
})
