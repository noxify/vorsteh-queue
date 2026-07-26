import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { MemoryQueueAdapter } from "../src/adapters/memory"
import { FlowProducer } from "../src/flow-producer"
import type { JobContext, JobWithProgress } from "../src/types"
import { Worker } from "../src/worker"

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe("FlowProducer", () => {
  let adapter: MemoryQueueAdapter
  let flowProducer: FlowProducer
  let worker: Worker

  beforeEach(async () => {
    adapter = new MemoryQueueAdapter()
    await adapter.connect()
    adapter.setQueueName("test-queue")
    flowProducer = new FlowProducer(adapter)
    worker = new Worker(adapter, {
      concurrency: 5,
      name: "test-queue",
      pollInterval: 10,
      removeOnComplete: false,
    })
  })

  afterEach(async () => {
    if (worker.isRunning) {
      await worker.stop()
    }
  })

  // ─── Task 71: FlowProducer.add, addChain, addBulkThen ─────

  describe("add", () => {
    it("should create a flow with parent and children", async () => {
      const result = await flowProducer.add({
        name: "parent",
        queueName: "test-queue",
        payload: { root: true },
        children: [
          { name: "child-a", queueName: "test-queue", payload: { n: 1 } },
          { name: "child-b", queueName: "test-queue", payload: { n: 2 } },
        ],
      })

      expect(result.flowId).toBeDefined()
      expect(result.rootNode.name).toBe("parent")
      expect(result.rootNode.childrenCount).toBe(2)
      expect(result.rootNode.childrenCompleted).toBe(0)
    })

    it("should set leaf nodes to ready and parent to waiting", async () => {
      const result = await flowProducer.add({
        name: "parent",
        queueName: "test-queue",
        payload: {},
        children: [{ name: "leaf", queueName: "test-queue", payload: {} }],
      })

      const tree = await flowProducer.getFlow(result.flowId)
      expect(tree).not.toBeNull()
      expect(tree?.node.status).toBe("waiting")
      expect(tree?.children[0]?.node.status).toBe("ready")
    })

    it("should create leaf jobs in queue", async () => {
      const result = await flowProducer.add({
        name: "parent",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "child-a", queueName: "test-queue", payload: { x: 1 } },
        ],
      })

      const tree = await flowProducer.getFlow(result.flowId)
      const leafNode = tree?.children[0]?.node
      expect(leafNode?.jobId).toBeDefined()

      const job = await adapter.getJobById(leafNode?.jobId ?? "")
      expect(job).not.toBeNull()
      expect(job?.name).toBe("child-a")
      expect(job?.status).toBe("pending")
      expect(job?.flowNodeId).toBe(leafNode?.id)
    })

    it("should emit flow:created event", async () => {
      const handler = vi.fn()
      flowProducer.on("flow:created", handler)

      const result = await flowProducer.add({
        name: "solo",
        queueName: "test-queue",
        payload: {},
      })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ flowId: result.flowId })
      )
    })
  })

  describe("addChain", () => {
    it("should create a sequential chain", async () => {
      const result = await flowProducer.addChain([
        { name: "step-1", queueName: "test-queue", payload: { order: 1 } },
        { name: "step-2", queueName: "test-queue", payload: { order: 2 } },
        { name: "step-3", queueName: "test-queue", payload: { order: 3 } },
      ])

      expect(result.flowId).toBeDefined()
      expect(result.nodes).toHaveLength(3)
    })

    it("should order nodes from first-to-execute to last", async () => {
      const result = await flowProducer.addChain([
        { name: "first", queueName: "test-queue", payload: {} },
        { name: "second", queueName: "test-queue", payload: {} },
        { name: "third", queueName: "test-queue", payload: {} },
      ])

      expect(result.nodes[0]?.name).toBe("first")
      expect(result.nodes[1]?.name).toBe("second")
      expect(result.nodes[2]?.name).toBe("third")

      // First node is the leaf (ready), last is root (waiting)
      expect(result.nodes[0]?.status).toBe("ready")
      expect(result.nodes[2]?.status).toBe("waiting")
    })

    it("should throw on empty steps", async () => {
      await expect(flowProducer.addChain([])).rejects.toThrow(
        "addChain requires at least 1 step"
      )
    })
  })

  describe("addBulkThen", () => {
    it("should create a fan-in pattern", async () => {
      const result = await flowProducer.addBulkThen(
        [
          { name: "worker-a", queueName: "test-queue", payload: { id: "a" } },
          { name: "worker-b", queueName: "test-queue", payload: { id: "b" } },
        ],
        { name: "aggregator", queueName: "test-queue", payload: {} }
      )

      expect(result.flowId).toBeDefined()
      expect(result.parallelNodes).toHaveLength(2)
      expect(result.finalNode.name).toBe("aggregator")
      expect(result.finalNode.status).toBe("waiting")
      expect(result.parallelNodes[0]?.status).toBe("ready")
      expect(result.parallelNodes[1]?.status).toBe("ready")
    })

    it("should throw on empty parallel array", async () => {
      await expect(
        flowProducer.addBulkThen([], {
          name: "final",
          queueName: "test-queue",
          payload: {},
        })
      ).rejects.toThrow("addBulkThen requires at least 1 parallel step")
    })
  })

  // ─── Task 70: Integration tests ───────────────────────────

  describe("integration: full lifecycle", () => {
    it("should promote parent after all children complete", async () => {
      const order: string[] = []

      worker.register("parent-job", async () => {
        order.push("parent")
        return { merged: true }
      })
      worker.register("child-job", async (job: JobWithProgress) => {
        order.push(`child:${(job.payload as { n: number }).n}`)
        return { value: (job.payload as { n: number }).n }
      })

      await flowProducer.add({
        name: "parent-job",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "child-job", queueName: "test-queue", payload: { n: 1 } },
          { name: "child-job", queueName: "test-queue", payload: { n: 2 } },
        ],
      })

      worker.start()
      await wait(300)

      expect(order).toContain("parent")
      expect(order.indexOf("parent")).toBeGreaterThan(order.indexOf("child:1"))
      expect(order.indexOf("parent")).toBeGreaterThan(order.indexOf("child:2"))
    })

    it("should support nested flows (3 levels)", async () => {
      const order: string[] = []

      worker.register("root", async () => {
        order.push("root")
        return { level: "root" }
      })
      worker.register("mid", async () => {
        order.push("mid")
        return { level: "mid" }
      })
      worker.register("leaf", async () => {
        order.push("leaf")
        return { level: "leaf" }
      })

      await flowProducer.add({
        name: "root",
        queueName: "test-queue",
        payload: {},
        children: [
          {
            name: "mid",
            queueName: "test-queue",
            payload: {},
            children: [{ name: "leaf", queueName: "test-queue", payload: {} }],
          },
        ],
      })

      worker.start()
      await wait(400)

      expect(order).toStrictEqual(["leaf", "mid", "root"])
    })

    it("should support cross-queue flows", async () => {
      const order: string[] = []

      const worker2 = new Worker(adapter, {
        concurrency: 5,
        name: "other-queue",
        pollInterval: 10,
        removeOnComplete: false,
      })

      worker.register("process", async () => {
        order.push("main-queue")
        return { queue: "main" }
      })
      worker2.register("notify", async () => {
        order.push("other-queue")
        return { queue: "other" }
      })

      await flowProducer.add({
        name: "process",
        queueName: "test-queue",
        payload: {},
        children: [{ name: "notify", queueName: "other-queue", payload: {} }],
      })

      worker.start()
      worker2.start()
      await wait(300)

      await worker2.stop()

      expect(order).toContain("other-queue")
      expect(order).toContain("main-queue")
      expect(order.indexOf("main-queue")).toBeGreaterThan(
        order.indexOf("other-queue")
      )
    })
  })

  // ─── Task 72: Failure strategies ──────────────────────────

  describe("failure strategies", () => {
    describe("default", () => {
      it("should promote parent when all children reach terminal state", async () => {
        const parentCalled = vi.fn()

        worker.register("parent-handler", async (_job, ctx: JobContext) => {
          parentCalled()
          const failed = await ctx.flow?.getFailedChildrenValues()
          return { failedCount: failed?.size ?? 0 }
        })
        worker.register("good-child", async () => ({ ok: true }))
        worker.register("bad-child", async () => {
          throw new Error("child failed")
        })

        await flowProducer.add({
          name: "parent-handler",
          queueName: "test-queue",
          payload: {},
          children: [
            {
              name: "good-child",
              queueName: "test-queue",
              payload: {},
            },
            {
              name: "bad-child",
              queueName: "test-queue",
              payload: {},
              options: { maxAttempts: 1 },
            },
          ],
        })

        worker.start()
        await wait(400)

        expect(parentCalled).toHaveBeenCalledOnce()
      })
    })

    describe("fail-parent", () => {
      it("should fail parent immediately when child with fail-parent dies", async () => {
        const parentCalled = vi.fn()

        worker.register("will-not-run", async () => {
          parentCalled()
          return {}
        })
        worker.register("child-explodes", async () => {
          throw new Error("kaboom")
        })

        const result = await flowProducer.add({
          name: "will-not-run",
          queueName: "test-queue",
          payload: {},
          children: [
            {
              name: "child-explodes",
              queueName: "test-queue",
              payload: {},
              failureStrategy: "fail-parent",
              options: { maxAttempts: 1 },
            },
          ],
        })

        worker.start()
        await wait(300)

        expect(parentCalled).not.toHaveBeenCalled()

        const tree = await flowProducer.getFlow(result.flowId)
        expect(tree?.node.status).toBe("failed")
      })

      it("should cascade recursively to grandparent", async () => {
        const rootCalled = vi.fn()

        worker.register("root-handler", async () => {
          rootCalled()
          return {}
        })
        worker.register("mid-handler", async () => ({}))
        worker.register("leaf-fails", async () => {
          throw new Error("deep failure")
        })

        const result = await flowProducer.add({
          name: "root-handler",
          queueName: "test-queue",
          payload: {},
          children: [
            {
              name: "mid-handler",
              queueName: "test-queue",
              payload: {},
              failureStrategy: "fail-parent",
              children: [
                {
                  name: "leaf-fails",
                  queueName: "test-queue",
                  payload: {},
                  failureStrategy: "fail-parent",
                  options: { maxAttempts: 1 },
                },
              ],
            },
          ],
        })

        worker.start()
        await wait(400)

        expect(rootCalled).not.toHaveBeenCalled()

        const tree = await flowProducer.getFlow(result.flowId)
        expect(tree?.node.status).toBe("failed")
        expect(tree?.children[0]?.node.status).toBe("failed")
      })
    })

    describe("continue-parent", () => {
      it("should promote parent immediately when child with continue-parent fails", async () => {
        const parentCalled = vi.fn()

        worker.register("eager-parent", async () => {
          parentCalled()
          return { eager: true }
        })
        worker.register("slow-child", async () => {
          throw new Error("I failed but parent continues")
        })

        await flowProducer.add({
          name: "eager-parent",
          queueName: "test-queue",
          payload: {},
          children: [
            {
              name: "slow-child",
              queueName: "test-queue",
              payload: {},
              failureStrategy: "continue-parent",
              options: { maxAttempts: 1 },
            },
          ],
        })

        worker.start()
        await wait(400)

        expect(parentCalled).toHaveBeenCalledOnce()
      })
    })
  })

  // ─── Task 73: FlowJobContext ──────────────────────────────

  describe("FlowJobContext", () => {
    it("should provide getChildrenValues in parent handler", async () => {
      let childrenValues: ReadonlyMap<string, unknown> | undefined

      worker.register("aggregator", async (_job, ctx: JobContext) => {
        childrenValues = await ctx.flow?.getChildrenValues()
        return { aggregated: true }
      })
      worker.register("producer", async (job: JobWithProgress) => ({
        produced: (job.payload as { id: number }).id,
      }))

      await flowProducer.add({
        name: "aggregator",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "producer", queueName: "test-queue", payload: { id: 1 } },
          { name: "producer", queueName: "test-queue", payload: { id: 2 } },
        ],
      })

      worker.start()
      await wait(400)

      expect(childrenValues).toBeDefined()
      expect(childrenValues?.size).toBe(2)
      const values = [...(childrenValues?.values() ?? [])]
      expect(values).toContainEqual({ produced: 1 })
      expect(values).toContainEqual({ produced: 2 })
    })

    it("should provide getFailedChildrenValues in parent handler", async () => {
      let failedValues: ReadonlyMap<string, unknown> | undefined

      worker.register("collector", async (_job, ctx: JobContext) => {
        failedValues = await ctx.flow?.getFailedChildrenValues()
        return { collected: true }
      })
      worker.register("fails", async () => {
        throw new Error("intentional")
      })
      worker.register("succeeds", async () => ({ ok: true }))

      await flowProducer.add({
        name: "collector",
        queueName: "test-queue",
        payload: {},
        children: [
          {
            name: "fails",
            queueName: "test-queue",
            payload: {},
            options: { maxAttempts: 1 },
          },
          { name: "succeeds", queueName: "test-queue", payload: {} },
        ],
      })

      worker.start()
      await wait(400)

      expect(failedValues).toBeDefined()
      expect(failedValues?.size).toBe(1)
      const [error] = [...(failedValues?.values() ?? [])]
      expect((error as { message: string }).message).toBe("intentional")
    })

    it("should provide getChildrenValuesBy with filter", async () => {
      let filteredValues: ReadonlyMap<string, unknown> | undefined

      worker.register("filter-parent", async (_job, ctx: JobContext) => {
        filteredValues = await ctx.flow?.getChildrenValuesBy({
          status: "completed",
          name: "target",
        })
        return {}
      })
      worker.register("target", async () => ({ targeted: true }))
      worker.register("other", async () => ({ other: true }))

      await flowProducer.add({
        name: "filter-parent",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "target", queueName: "test-queue", payload: {} },
          { name: "other", queueName: "test-queue", payload: {} },
        ],
      })

      worker.start()
      await wait(400)

      expect(filteredValues).toBeDefined()
      expect(filteredValues?.size).toBe(1)
      const [value] = [...(filteredValues?.values() ?? [])] as [
        { result?: unknown },
      ]
      expect(value.result).toStrictEqual({ targeted: true })
    })

    it("should provide removeUnprocessedChildren", async () => {
      let cancelledCount: number | undefined

      await worker.stop()
      const singleWorker = new Worker(adapter, {
        concurrency: 1,
        name: "test-queue",
        pollInterval: 10,
        removeOnComplete: false,
      })

      singleWorker.register("cancel-parent", async (_job, ctx: JobContext) => {
        cancelledCount = await ctx.flow?.removeUnprocessedChildren()
        return { cancelled: cancelledCount }
      })
      singleWorker.register("fast-trigger", async () => {
        throw new Error("trigger parent")
      })

      await flowProducer.add({
        name: "cancel-parent",
        queueName: "test-queue",
        payload: {},
        children: [
          {
            name: "fast-trigger",
            queueName: "test-queue",
            payload: {},
            failureStrategy: "continue-parent",
            options: { maxAttempts: 1 },
          },
          {
            name: "unregistered-handler",
            queueName: "test-queue",
            payload: {},
          },
        ],
      })

      singleWorker.start()
      await wait(400)
      await singleWorker.stop()

      expect(cancelledCount).toBeDefined()
      expect(cancelledCount).toBeGreaterThanOrEqual(1)
    })
  })

  // ─── Task 74: Cleanup ─────────────────────────────────────

  describe("removeOnComplete", () => {
    it("should cleanup flows after root completes when configured", async () => {
      const cleanupProducer = new FlowProducer(adapter, {
        removeOnComplete: true,
      })

      worker.register("cleanup-parent", async () => ({ done: true }))
      worker.register("cleanup-child", async () => ({ done: true }))

      const result = await cleanupProducer.add({
        name: "cleanup-parent",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "cleanup-child", queueName: "test-queue", payload: {} },
        ],
      })

      worker.start()
      await wait(300)

      await cleanupProducer.cleanupCompletedFlows()

      const tree = await cleanupProducer.getFlow(result.flowId)
      expect(tree).toBeNull()
    })

    it("should keep flows when removeOnComplete is false", async () => {
      const keepProducer = new FlowProducer(adapter, {
        removeOnComplete: false,
      })

      worker.register("keep-parent", async () => ({ kept: true }))
      worker.register("keep-child", async () => ({ kept: true }))

      const result = await keepProducer.add({
        name: "keep-parent",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "keep-child", queueName: "test-queue", payload: {} },
        ],
      })

      worker.start()
      await wait(300)

      await keepProducer.cleanupCompletedFlows()

      const tree = await keepProducer.getFlow(result.flowId)
      expect(tree).not.toBeNull()
    })
  })

  // ─── Task 75: Events ──────────────────────────────────────

  describe("events", () => {
    it("should emit flow:created on add", async () => {
      const handler = vi.fn()
      flowProducer.on("flow:created", handler)

      await flowProducer.add({
        name: "event-test",
        queueName: "test-queue",
        payload: {},
      })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: expect.any(String),
          rootNode: expect.objectContaining({ name: "event-test" }),
        })
      )
    })

    it("should emit flow:node:promoted when parent is promoted", async () => {
      const promoted = vi.fn()
      worker.on("flow:node:promoted", promoted)

      worker.register("promo-parent", async () => ({ promoted: true }))
      worker.register("promo-child", async () => ({ done: true }))

      await flowProducer.add({
        name: "promo-parent",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "promo-child", queueName: "test-queue", payload: {} },
        ],
      })

      worker.start()
      await wait(300)

      expect(promoted).toHaveBeenCalledOnce()
      expect(promoted).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: expect.any(String),
          nodeId: expect.any(String),
          jobId: expect.any(String),
        })
      )
    })

    it("should emit flow:completed when root job completes", async () => {
      const completed = vi.fn()
      worker.on("flow:completed", completed)

      worker.register("complete-parent", async () => ({ result: "done" }))
      worker.register("complete-child", async () => ({ ok: true }))

      await flowProducer.add({
        name: "complete-parent",
        queueName: "test-queue",
        payload: {},
        children: [
          { name: "complete-child", queueName: "test-queue", payload: {} },
        ],
      })

      worker.start()
      await wait(400)

      expect(completed).toHaveBeenCalledOnce()
      expect(completed).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: expect.any(String),
          result: { result: "done" },
        })
      )
    })

    it("should emit flow:failed when root node fails", async () => {
      const failed = vi.fn()
      worker.on("flow:failed", failed)

      worker.register("fail-parent", async () => {
        throw new Error("root failure")
      })
      worker.register("ok-child", async () => ({ fine: true }))

      await flowProducer.add({
        name: "fail-parent",
        queueName: "test-queue",
        payload: {},
        options: { maxAttempts: 1 },
        children: [{ name: "ok-child", queueName: "test-queue", payload: {} }],
      })

      worker.start()
      await wait(400)

      expect(failed).toHaveBeenCalledOnce()
      expect(failed).toHaveBeenCalledWith(
        expect.objectContaining({
          flowId: expect.any(String),
          error: expect.objectContaining({ message: "root failure" }),
        })
      )
    })
  })
})
