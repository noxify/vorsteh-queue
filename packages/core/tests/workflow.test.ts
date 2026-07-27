/**
 * Tests for Workflow Engine features:
 * - Saga Compensation
 * - Signals / waitFor
 * - Event Triggers
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import { Queue } from "../src/queue"
import type { JobContext, JobWithProgress } from "../src/types"
import { Worker } from "../src/worker"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("Workflow Engine", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue
  let worker: Worker

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "workflow-queue" })
    worker = new Worker(adapter, {
      concurrency: 2,
      name: "workflow-queue",
      pollInterval: 10,
    })
    await queue.connect()
  })

  afterEach(async () => {
    if (worker.isRunning) {
      await worker.stop()
    }
  })

  describe("Saga Compensation", () => {
    it("should run compensations in reverse order on step failure", async () => {
      const compensationOrder: string[] = []

      worker.register(
        "saga-job",
        async (_job: JobWithProgress, { step }: JobContext) => {
          await step.run("step-a", async () => "result-a", {
            compensate: async () => {
              compensationOrder.push("compensate-a")
            },
          })
          await step.run("step-b", async () => "result-b", {
            compensate: async () => {
              compensationOrder.push("compensate-b")
            },
          })
          // This step fails
          await step.run("step-c", async () => {
            throw new Error("step-c failed")
          })
          return {}
        }
      )

      await queue.add("saga-job", {}, { maxAttempts: 1 })
      worker.start()
      await wait(100)

      // Compensations should run in reverse: b, a
      expect(compensationOrder).toStrictEqual(["compensate-b", "compensate-a"])
    })

    it("should pass step result to compensation function", async () => {
      let compensatedWith: unknown

      worker.register(
        "saga-result",
        async (_job: JobWithProgress, { step }: JobContext) => {
          await step.run("create", async () => ({ id: "resource-123" }), {
            compensate: async (result) => {
              compensatedWith = result
            },
          })
          await step.run("fails", async () => {
            throw new Error("oops")
          })
          return {}
        }
      )

      await queue.add("saga-result", {}, { maxAttempts: 1 })
      worker.start()
      await wait(100)

      expect(compensatedWith).toStrictEqual({ id: "resource-123" })
    })

    it("should not run compensations on success", async () => {
      const compensations: string[] = []

      worker.register(
        "saga-success",
        async (_job: JobWithProgress, { step }: JobContext) => {
          await step.run("step-a", async () => "ok", {
            compensate: async () => {
              compensations.push("a")
            },
          })
          return { done: true }
        }
      )

      await queue.add("saga-success", {})
      worker.start()
      await wait(50)

      expect(compensations).toHaveLength(0)
    })

    it("should continue compensations even if one fails", async () => {
      const compensations: string[] = []
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      worker.register(
        "saga-partial",
        async (_job: JobWithProgress, { step }: JobContext) => {
          await step.run("step-a", async () => "a", {
            compensate: async () => {
              compensations.push("a")
            },
          })
          await step.run("step-b", async () => "b", {
            compensate: async () => {
              throw new Error("compensation failed")
            },
          })
          await step.run("step-c", async () => "c", {
            compensate: async () => {
              compensations.push("c")
            },
          })
          await step.run("fails", async () => {
            throw new Error("boom")
          })
          return {}
        }
      )

      await queue.add("saga-partial", {}, { maxAttempts: 1 })
      worker.start()
      await wait(100)

      // c and a should still run despite b's compensation failing
      expect(compensations).toContain("a")
      expect(compensations).toContain("c")
      consoleSpy.mockRestore()
    })
  })

  describe("Signals / waitFor", () => {
    it("should pause job on waitFor and resume on signal", async () => {
      const executed: string[] = []

      worker.register(
        "signal-job",
        async (_job: JobWithProgress, { step }: JobContext) => {
          await step.run("before", async () => {
            executed.push("before")
            return "done"
          })
          const approval = await step.waitFor<{ approved: boolean }>(
            "wait-approval",
            "approval"
          )
          await step.run("after", async () => {
            executed.push(`after:${approval.approved}`)
            return "done"
          })
          return { approved: approval.approved }
        }
      )

      const job = await queue.add("signal-job", {})
      worker.start()
      await wait(50)

      // Job should be paused (delayed) after waitFor
      expect(executed).toStrictEqual(["before"])
      const paused = await queue.getJob(job.id)
      expect(paused?.status).toBe("delayed")

      // Send signal
      await queue.signal(job.id, "approval", { approved: true })

      // Wait for worker to pick it up again
      await wait(100)

      expect(executed).toContain("after:true")
    })

    it("should replay completed waitFor on retry", async () => {
      let callCount = 0

      worker.register(
        "signal-replay",
        async (_job: JobWithProgress, { step }: JobContext) => {
          callCount += 1
          const data = await step.waitFor<{ value: number }>("wait", "my-event")
          return { calls: callCount, received: data.value }
        }
      )

      const job = await queue.add("signal-replay", {})
      worker.start()
      await wait(30)

      // Send signal
      await queue.signal(job.id, "my-event", { value: 42 })
      await wait(100)

      const completed = await queue.getJob(job.id)
      expect(completed?.status).toBe("completed")
      expect(completed?.result).toStrictEqual({ calls: 2, received: 42 })
    })
  })

  describe("Event Triggers", () => {
    it("should create a new job when trigger fires", async () => {
      worker.register("order", async () => ({
        email: "user@test.com",
        orderId: "ORD-1",
      }))
      worker.register("receipt", async (job: JobWithProgress) => ({
        sent: true,
        to: (job.payload as { email: string }).email,
      }))

      worker.trigger({
        create: "receipt",
        data: (result) => ({ email: (result as { email: string }).email }),
        on: "order",
      })

      await queue.add("order", {})
      worker.start()
      await wait(100)

      const stats = await queue.getStats()
      // order completed + receipt completed (or at least created)
      expect(stats.completed).toBeGreaterThanOrEqual(1)

      // Check that receipt job was created
      // (it may already be completed if worker picked it up)
      const totalJobs = stats.pending + stats.completed + stats.processing
      expect(totalJobs).toBeGreaterThanOrEqual(2)
    })

    it("should not fire trigger when condition is false", async () => {
      worker.register("payment", async () => ({ amount: 50 }))
      worker.register("fraud-alert", async () => ({ alerted: true }))

      worker.trigger({
        condition: (result) => (result as { amount: number }).amount > 1000,
        create: "fraud-alert",
        data: (result) => result,
        on: "payment",
      })

      await queue.add("payment", {})
      worker.start()
      await wait(100)

      const stats = await queue.getStats()
      // Only payment completed, no fraud-alert created
      expect(stats.completed).toBe(1)
    })

    it("should fire trigger when condition is true", async () => {
      worker.register("big-payment", async () => ({ amount: 5000 }))
      worker.register("fraud-alert", async () => ({ alerted: true }))

      worker.trigger({
        condition: (result) => (result as { amount: number }).amount > 1000,
        create: "fraud-alert",
        data: (result) => ({ amount: (result as { amount: number }).amount }),
        on: "big-payment",
      })

      await queue.add("big-payment", {})
      worker.start()
      await wait(100)

      const stats = await queue.getStats()
      expect(stats.completed).toBeGreaterThanOrEqual(2) // payment + fraud-alert
    })

    it("should support trigger chaining", async () => {
      worker.register("step-1", async () => ({ value: 1 }))
      worker.register("step-2", async () => ({ value: 2 }))
      worker.register("step-3", async () => ({ value: 3 }))

      worker
        .trigger({ create: "step-2", data: (r) => r, on: "step-1" })
        .trigger({ create: "step-3", data: (r) => r, on: "step-2" })

      await queue.add("step-1", {})
      worker.start()
      await wait(150)

      const stats = await queue.getStats()
      expect(stats.completed).toBe(3) // all three completed via chaining
    })
  })

  describe("E2E: Multi-step workflow with compensation", () => {
    it("should execute full saga and compensate on failure", async () => {
      const actions: string[] = []

      worker.register(
        "checkout",
        async (_job: JobWithProgress, { step }: JobContext) => {
          await step.run(
            "reserve",
            async () => {
              actions.push("reserve")
              return { reservationId: "R1" }
            },
            {
              compensate: async () => {
                actions.push("release-reservation")
              },
            }
          )

          await step.run(
            "charge",
            async () => {
              actions.push("charge")
              return { txId: "TX1" }
            },
            {
              compensate: async () => {
                actions.push("refund")
              },
            }
          )

          await step.run("ship", async () => {
            actions.push("ship-attempt")
            throw new Error("shipping unavailable")
          })

          return {}
        }
      )

      await queue.add("checkout", {}, { maxAttempts: 1 })
      worker.start()
      await wait(100)

      expect(actions).toStrictEqual([
        "reserve",
        "charge",
        "ship-attempt",
        "refund", // reverse order
        "release-reservation",
      ])
    })
  })

  describe("E2E: Human-in-the-loop signal flow", () => {
    it("should pause, wait for approval, then continue", async () => {
      const timeline: string[] = []

      worker.register(
        "expense",
        async (job: JobWithProgress, { step }: JobContext) => {
          await step.run("submit", async () => {
            timeline.push("submitted")
            return { expenseId: (job.payload as { id: string }).id }
          })

          const decision = await step.waitFor<{ approved: boolean }>(
            "approval-wait",
            "manager-decision"
          )
          timeline.push(`decision:${decision.approved}`)

          await step.run("finalize", async () => {
            timeline.push("finalized")
            return { status: decision.approved ? "paid" : "rejected" }
          })

          return { approved: decision.approved }
        }
      )

      const job = await queue.add("expense", { id: "EXP-1" })
      worker.start()
      await wait(50)

      expect(timeline).toStrictEqual(["submitted"])

      // Simulate manager approval
      await queue.signal(job.id, "manager-decision", { approved: true })
      await wait(100)

      expect(timeline).toStrictEqual([
        "submitted",
        "decision:true",
        "finalized",
      ])

      const result = await queue.getJob(job.id)
      expect(result?.status).toBe("completed")
      expect(result?.result).toStrictEqual({ approved: true })
    })
  })
})
