/**
 * Tests for Flow Producer (Parent-Child Job Trees)
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import { Queue } from "../src/queue"
import type { JobContext, JobWithProgress } from "../src/types"
import { Worker } from "../src/worker"

const wait = (ms: number) =>
  // eslint-disable-next-line promise/avoid-new
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("Flow Producer", () => {
  let adapter: MemoryQueueAdapter
  let queue: Queue
  let worker: Worker

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    queue = new Queue(adapter, { name: "flow-queue" })
    worker = new Worker(adapter, {
      name: "flow-queue",
      pollInterval: 10,
      concurrency: 5,
    })
    await queue.connect()
  })

  afterEach(async () => {
    if (worker.isRunning) {
      await worker.stop()
    }
  })

  describe("addFlow", () => {
    // eslint-disable-next-line vitest/max-expects
    it("should create a flow with parent and children", async () => {
      const flow = await queue.addFlow({
        name: "parent",
        payload: { root: true },
        children: [
          { name: "child-a", payload: { n: 1 } },
          { name: "child-b", payload: { n: 2 } },
        ],
      })

      /* eslint-disable vitest/max-expects */
      expect(flow.id).toBeDefined()
      expect(flow.job.name).toBe("parent")
      expect(flow.job.status).toBe("waiting-children")
      expect(flow.job.flowId).toBe(flow.id)
      expect(flow.job.childrenCount).toBe(2)
      expect(flow.job.childrenCompleted).toBe(0)
      /* eslint-enable vitest/max-expects */
    })

    it("should create children as pending", async () => {
      const flow = await queue.addFlow({
        name: "parent",
        payload: {},
        children: [{ name: "child", payload: {} }],
      })

      const tree = await queue.getFlowTree(flow.id)
      expect(tree?.children).toHaveLength(1)
      expect(tree?.children[0]?.job.status).toBe("pending")
      expect(tree?.children[0]?.job.parentId).toBe(flow.job.id)
      expect(tree?.children[0]?.job.flowId).toBe(flow.id)
    })

    // eslint-disable-next-line vitest/max-expects
    it("should handle nested children (grandchildren)", async () => {
      const flow = await queue.addFlow({
        name: "root",
        payload: {},
        children: [
          {
            name: "mid",
            payload: {},
            children: [{ name: "leaf", payload: {} }],
          },
        ],
      })

      /* eslint-disable vitest/max-expects */
      const tree = await queue.getFlowTree(flow.id)
      expect(tree?.job.name).toBe("root")
      expect(tree?.job.status).toBe("waiting-children")
      expect(tree?.children[0]?.job.name).toBe("mid")
      expect(tree?.children[0]?.job.status).toBe("waiting-children")
      expect(tree?.children[0]?.children[0]?.job.name).toBe("leaf")
      expect(tree?.children[0]?.children[0]?.job.status).toBe("pending")
      /* eslint-enable vitest/max-expects */
    })

    it("should create leaf-only flow as pending", async () => {
      const flow = await queue.addFlow({
        name: "solo",
        payload: {},
      })

      expect(flow.job.status).toBe("pending")
      expect(flow.job.childrenCount).toBe(0)
    })
  })

  describe("getFlowTree", () => {
    it("should return full tree structure", async () => {
      const flow = await queue.addFlow({
        name: "deploy",
        payload: {},
        children: [
          { name: "build", payload: { target: "linux" } },
          { name: "build", payload: { target: "macos" } },
        ],
      })

      const tree = await queue.getFlowTree(flow.id)
      expect(tree).not.toBeNull()
      expect(tree?.job.name).toBe("deploy")
      expect(tree?.children).toHaveLength(2)
    })

    it("should return null for unknown flowId", async () => {
      const tree = await queue.getFlowTree("nonexistent")
      expect(tree).toBeNull()
    })
  })

  describe("E2E: full flow lifecycle", () => {
    it("should process children first, then parent", async () => {
      const order: string[] = []

      worker.register(
        "parent-job",
        async (job: JobWithProgress, ctx: JobContext) => {
          order.push("parent")
          const childResults = await ctx.getChildrenResults?.()
          return { childCount: childResults?.size ?? 0 }
        }
      )
      worker.register("child-job", async (job: JobWithProgress) => {
        order.push(`child:${(job.payload as { n: number }).n}`)
        return { processed: (job.payload as { n: number }).n }
      })

      const flow = await queue.addFlow({
        name: "parent-job",
        payload: {},
        children: [
          { name: "child-job", payload: { n: 1 } },
          { name: "child-job", payload: { n: 2 } },
        ],
      })

      worker.start()
      await wait(200)

      // Children should process before parent
      expect(order.indexOf("parent")).toBeGreaterThan(order.indexOf("child:1"))
      expect(order.indexOf("parent")).toBeGreaterThan(order.indexOf("child:2"))

      // Parent should be completed
      const parentJob = await queue.getJob(flow.job.id)
      expect(parentJob?.status).toBe("completed")
      expect(parentJob?.result).toStrictEqual({ childCount: 2 })
    })

    it("should handle nested flow (leaf → mid → root)", async () => {
      const order: string[] = []

      worker.register("root", async () => {
        order.push("root")
        return {}
      })
      worker.register("mid", async () => {
        order.push("mid")
        return {}
      })
      worker.register("leaf", async () => {
        order.push("leaf")
        return {}
      })

      const flow = await queue.addFlow({
        name: "root",
        payload: {},
        children: [
          {
            name: "mid",
            payload: {},
            children: [{ name: "leaf", payload: {} }],
          },
        ],
      })

      worker.start()
      await wait(200)

      expect(order).toStrictEqual(["leaf", "mid", "root"])

      const rootJob = await queue.getJob(flow.job.id)
      expect(rootJob?.status).toBe("completed")
    })
  })

  describe("E2E: failParentOnFailure", () => {
    it("should fail parent when child fails with failParentOnFailure", async () => {
      worker.register("parent-safe", async () => ({ done: true }))
      worker.register("child-fails", async () => {
        throw new Error("boom")
      })

      const flow = await queue.addFlow({
        name: "parent-safe",
        payload: {},
        children: [
          {
            name: "child-fails",
            payload: {},
            failParentOnFailure: true,
            options: { maxAttempts: 1 },
          },
        ],
      })

      worker.start()
      await wait(150)

      const parentJob = await queue.getJob(flow.job.id)
      // Parent should be failed because child failed with failParentOnFailure
      expect(parentJob?.status).toBe("failed")
    })

    it("should NOT fail parent when failParentOnFailure is false", async () => {
      worker.register("parent-resilient", async () => ({ done: true }))
      worker.register("child-explodes", async () => {
        throw new Error("nope")
      })

      const flow = await queue.addFlow({
        name: "parent-resilient",
        payload: {},
        children: [
          { name: "child-explodes", payload: {} }, // failParentOnFailure defaults to false
        ],
      })

      worker.start()
      await wait(150)

      const parentJob = await queue.getJob(flow.job.id)
      // Parent should still be waiting-children (child is retrying/dead, not promoting)
      expect(parentJob?.status).toBe("waiting-children")
    })
  })
})
