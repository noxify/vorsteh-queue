import type {
  FlowAdapter,
  NewFlowNode,
  NewJob,
  QueueAdapter,
} from "@vorsteh-queue/core"
import postgres from "postgres"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { initDatabase } from "../database"
import type { FlowAdapterTestContext } from "../types"

export function runFlowAdapterTests<TDatabase = unknown>(
  ctx: FlowAdapterTestContext<TDatabase>
) {
  describe.each(ctx.testCases)(
    "FlowAdapter Tests - $description",
    ({ modelName, schemaName, tableName, useDefault }) => {
      let database: Awaited<ReturnType<typeof initDatabase>>
      let db: ReturnType<FlowAdapterTestContext<TDatabase>["initDbClient"]>
      let adapter: FlowAdapter & QueueAdapter
      let internalDbClient: postgres.Sql

      beforeAll(async () => {
        database = await initDatabase(
          // eslint-disable-next-line no-restricted-properties
          process.env.PG_VERSION ? Number(process.env.PG_VERSION) : 17
        )

        // eslint-disable-next-line no-restricted-properties
        vi.stubEnv("DATABASE_URL", database.container.getConnectionUri())

        internalDbClient = postgres(database.container.getConnectionUri(), {
          max: 10,
        })
        db = ctx.initDbClient(database)

        await internalDbClient`CREATE EXTENSION IF NOT EXISTS pgcrypto CASCADE;`

        await ctx.migrate(db)
      }, 60_000)

      afterAll(async () => {
        await (adapter as QueueAdapter).disconnect()
        await database.container.stop()
      })

      beforeEach(async () => {
        // Clean flow and job tables
        await internalDbClient`DELETE FROM queue_flows`
        // eslint-disable-next-line unicorn/prefer-ternary
        if (useDefault === false) {
          await internalDbClient`DELETE FROM ${internalDbClient(schemaName)}.${internalDbClient(tableName)};`
        } else {
          await internalDbClient`DELETE FROM queue_jobs`
        }

        adapter = await ctx.initAdapter(
          db,
          useDefault === false ? { modelName, schemaName, tableName } : {}
        )

        await (adapter as QueueAdapter).connect()
        ;(adapter as QueueAdapter).setQueueName("test-queue")
      })

      // ─── Helper: create a simple flow tree ────────────────────────────
      // eslint-disable-next-line unicorn/consistent-function-scoping
      function createSimpleFlowData(flowId: string) {
        const parentId = crypto.randomUUID()
        const child1Id = crypto.randomUUID()
        const child2Id = crypto.randomUUID()

        const nodes: NewFlowNode[] = [
          {
            id: parentId,
            flowId,
            queueName: "test-queue",
            name: "parent-handler",
            payload: { role: "parent" },
            status: "waiting",
            failureStrategy: "default",
            childrenCount: 2,
            childrenCompleted: 0,
          },
          {
            id: child1Id,
            flowId,
            parentNodeId: parentId,
            queueName: "test-queue",
            name: "child-handler",
            payload: { role: "child", n: 1 },
            status: "ready",
            failureStrategy: "default",
            childrenCount: 0,
            childrenCompleted: 0,
            jobId: crypto.randomUUID(),
          },
          {
            id: child2Id,
            flowId,
            parentNodeId: parentId,
            queueName: "test-queue",
            name: "child-handler",
            payload: { role: "child", n: 2 },
            status: "ready",
            failureStrategy: "default",
            childrenCount: 0,
            childrenCompleted: 0,
            jobId: crypto.randomUUID(),
          },
        ]

        const leafJobs: NewJob[] = [
          {
            name: "child-handler",
            payload: { role: "child", n: 1 },
            status: "pending",
            priority: 2,
            attempts: 0,
            maxAttempts: 3,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            flowNodeId: child1Id,
          },
          {
            name: "child-handler",
            payload: { role: "child", n: 2 },
            status: "pending",
            priority: 2,
            attempts: 0,
            maxAttempts: 3,
            processAt: new Date(),
            progress: 0,
            repeatCount: 0,
            flowNodeId: child2Id,
          },
        ]

        return { nodes, leafJobs, parentId, child1Id, child2Id }
      }

      // ─── createFlow ──────────────────────────────────────────────────────

      describe("createFlow", () => {
        it("should create flow nodes atomically", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs } = createSimpleFlowData(flowId)

          const created = await adapter.createFlow(nodes, leafJobs)

          expect(created).toHaveLength(3)
          expect(created.every((n) => n.flowId === flowId)).toBe(true)
        })

        it("should create leaf jobs with flowNodeId set", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, child1Id } = createSimpleFlowData(flowId)

          await adapter.createFlow(nodes, leafJobs)

          // Verify via the flow node that the job was created
          const node = await adapter.getFlowNode(child1Id)
          expect(node).not.toBeNull()
          expect(node?.status).toBe("ready")
          expect(node?.jobId).toBeDefined()
        })

        it("should set leaf node status to ready with jobId", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, child1Id, child2Id } =
            createSimpleFlowData(flowId)

          await adapter.createFlow(nodes, leafJobs)

          const leaf1 = await adapter.getFlowNode(child1Id)
          const leaf2 = await adapter.getFlowNode(child2Id)

          expect(leaf1?.status).toBe("ready")
          expect(leaf1?.jobId).toBeDefined()
          expect(leaf2?.status).toBe("ready")
          expect(leaf2?.jobId).toBeDefined()
        })

        it("should set parent node status to waiting", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)

          await adapter.createFlow(nodes, leafJobs)

          const parent = await adapter.getFlowNode(parentId)
          expect(parent?.status).toBe("waiting")
          expect(parent?.jobId).toBeUndefined()
        })

        it("should handle nested trees (parent → child → grandchild)", async () => {
          const flowId = crypto.randomUUID()
          const rootId = crypto.randomUUID()
          const childId = crypto.randomUUID()
          const grandchildId = crypto.randomUUID()

          const nodes: NewFlowNode[] = [
            {
              id: rootId,
              flowId,
              queueName: "test-queue",
              name: "root",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 1,
              childrenCompleted: 0,
            },
            {
              id: childId,
              flowId,
              parentNodeId: rootId,
              queueName: "test-queue",
              name: "child",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 1,
              childrenCompleted: 0,
            },
            {
              id: grandchildId,
              flowId,
              parentNodeId: childId,
              queueName: "test-queue",
              name: "grandchild",
              payload: { level: "leaf" },
              status: "ready",
              failureStrategy: "default",
              childrenCount: 0,
              childrenCompleted: 0,
              jobId: crypto.randomUUID(),
            },
          ]

          const leafJobs: NewJob[] = [
            {
              name: "grandchild",
              payload: { level: "leaf" },
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 3,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              flowNodeId: grandchildId,
            },
          ]

          const created = await adapter.createFlow(nodes, leafJobs)

          expect(created).toHaveLength(3)

          const root = await adapter.getFlowNode(rootId)
          const child = await adapter.getFlowNode(childId)
          const grandchild = await adapter.getFlowNode(grandchildId)

          expect(root?.status).toBe("waiting")
          expect(root?.childrenCount).toBe(1)
          expect(child?.status).toBe("waiting")
          expect(child?.childrenCount).toBe(1)
          expect(grandchild?.status).toBe("ready")
          expect(grandchild?.childrenCount).toBe(0)
        })
      })

      // ─── getFlowNode ────────────────────────────────────────────────────

      describe("getFlowNode", () => {
        it("should return a flow node by ID", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)

          await adapter.createFlow(nodes, leafJobs)

          const node = await adapter.getFlowNode(parentId)
          expect(node).not.toBeNull()
          expect(node?.id).toBe(parentId)
          expect(node?.flowId).toBe(flowId)
          expect(node?.name).toBe("parent-handler")
          expect(node?.payload).toEqual({ role: "parent" })
        })

        it("should return null for unknown ID", async () => {
          const result = await adapter.getFlowNode(crypto.randomUUID())
          expect(result).toBeNull()
        })
      })

      // ─── getFlowTree ──────────────────────────────────────────────────────

      describe("getFlowTree", () => {
        it("should return the full tree structure", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)

          await adapter.createFlow(nodes, leafJobs)

          const tree = await adapter.getFlowTree(flowId)
          expect(tree).not.toBeNull()
          expect(tree?.node.id).toBe(parentId)
          expect(tree?.children).toHaveLength(2)
        })

        it("should return null for unknown flowId", async () => {
          const tree = await adapter.getFlowTree(crypto.randomUUID())
          expect(tree).toBeNull()
        })

        it("should correctly nest children under parents", async () => {
          const flowId = crypto.randomUUID()
          const rootId = crypto.randomUUID()
          const childId = crypto.randomUUID()
          const grandchildId = crypto.randomUUID()

          const nodes: NewFlowNode[] = [
            {
              id: rootId,
              flowId,
              queueName: "test-queue",
              name: "root",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 1,
              childrenCompleted: 0,
            },
            {
              id: childId,
              flowId,
              parentNodeId: rootId,
              queueName: "test-queue",
              name: "child",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 1,
              childrenCompleted: 0,
            },
            {
              id: grandchildId,
              flowId,
              parentNodeId: childId,
              queueName: "test-queue",
              name: "grandchild",
              payload: {},
              status: "ready",
              failureStrategy: "default",
              childrenCount: 0,
              childrenCompleted: 0,
              jobId: crypto.randomUUID(),
            },
          ]

          const leafJobs: NewJob[] = [
            {
              name: "grandchild",
              payload: {},
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 3,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              flowNodeId: grandchildId,
            },
          ]

          await adapter.createFlow(nodes, leafJobs)

          const tree = await adapter.getFlowTree(flowId)
          expect(tree).not.toBeNull()
          expect(tree?.node.id).toBe(rootId)
          expect(tree?.children).toHaveLength(1)
          expect(tree?.children[0]?.node.id).toBe(childId)
          expect(tree?.children[0]?.children).toHaveLength(1)
          expect(tree?.children[0]?.children[0]?.node.id).toBe(grandchildId)
          expect(tree?.children[0]?.children[0]?.children).toHaveLength(0)
        })
      })

      // ─── getFlows ────────────────────────────────────────────────────────

      describe("getFlows", () => {
        it("should list flows with pagination", async () => {
          // Create 3 flows
          for (let i = 0; i < 3; i++) {
            const flowId = crypto.randomUUID()
            const nodeId = crypto.randomUUID()
            const nodes: NewFlowNode[] = [
              {
                id: nodeId,
                flowId,
                queueName: "test-queue",
                name: `flow-${i}`,
                payload: {},
                status: "ready",
                failureStrategy: "default",
                childrenCount: 0,
                childrenCompleted: 0,
                jobId: crypto.randomUUID(),
              },
            ]
            const leafJobs: NewJob[] = [
              {
                name: `flow-${i}`,
                payload: {},
                status: "pending",
                priority: 2,
                attempts: 0,
                maxAttempts: 3,
                processAt: new Date(),
                progress: 0,
                repeatCount: 0,
                flowNodeId: nodeId,
              },
            ]
            await adapter.createFlow(nodes, leafJobs)
          }

          const page1 = await adapter.getFlows({ limit: 2, offset: 0 })
          expect(page1).toHaveLength(2)

          const page2 = await adapter.getFlows({ limit: 2, offset: 2 })
          expect(page2).toHaveLength(1)
        })

        it("should filter by status", async () => {
          // Create a completed flow (single node, mark as completed)
          const completedFlowId = crypto.randomUUID()
          const completedNodeId = crypto.randomUUID()
          await adapter.createFlow(
            [
              {
                id: completedNodeId,
                flowId: completedFlowId,
                queueName: "test-queue",
                name: "done",
                payload: {},
                status: "ready",
                failureStrategy: "default",
                childrenCount: 0,
                childrenCompleted: 0,
                jobId: crypto.randomUUID(),
              },
            ],
            [
              {
                name: "done",
                payload: {},
                status: "pending",
                priority: 2,
                attempts: 0,
                maxAttempts: 3,
                processAt: new Date(),
                progress: 0,
                repeatCount: 0,
                flowNodeId: completedNodeId,
              },
            ]
          )
          await adapter.updateFlowNode(completedNodeId, {
            status: "completed",
            completedAt: new Date(),
          })

          // Create a waiting flow
          const waitingFlowId = crypto.randomUUID()
          const { nodes, leafJobs } = createSimpleFlowData(waitingFlowId)
          await adapter.createFlow(nodes, leafJobs)

          const completedFlows = await adapter.getFlows({ status: "completed" })
          expect(completedFlows).toHaveLength(1)
          expect(completedFlows[0]?.flowId).toBe(completedFlowId)

          const waitingFlows = await adapter.getFlows({ status: "waiting" })
          expect(waitingFlows).toHaveLength(1)
          expect(waitingFlows[0]?.flowId).toBe(waitingFlowId)
        })

        it("should order by creation date descending", async () => {
          const flowIds: string[] = []
          for (let i = 0; i < 3; i++) {
            const flowId = crypto.randomUUID()
            flowIds.push(flowId)
            const nodeId = crypto.randomUUID()
            await adapter.createFlow(
              [
                {
                  id: nodeId,
                  flowId,
                  queueName: "test-queue",
                  name: `ordered-${i}`,
                  payload: {},
                  status: "ready",
                  failureStrategy: "default",
                  childrenCount: 0,
                  childrenCompleted: 0,
                  jobId: crypto.randomUUID(),
                },
              ],
              [
                {
                  name: `ordered-${i}`,
                  payload: {},
                  status: "pending",
                  priority: 2,
                  attempts: 0,
                  maxAttempts: 3,
                  processAt: new Date(),
                  progress: 0,
                  repeatCount: 0,
                  flowNodeId: nodeId,
                },
              ]
            )
            // Small delay to ensure different creation times
            await new Promise((resolve) => setTimeout(resolve, 50))
          }

          const flows = await adapter.getFlows()
          expect(flows.length).toBeGreaterThanOrEqual(3)
          // Most recent first
          const timestamps = flows.map((f) => f.createdAt.getTime())
          for (let i = 0; i < timestamps.length - 1; i++) {
            // oxlint-disable-next-line typescript/no-non-null-assertion
            expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]!)
          }
        })
      })

      // ─── updateFlowNode ──────────────────────────────────────────────────

      describe("updateFlowNode", () => {
        it("should update status", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, child1Id } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          await adapter.updateFlowNode(child1Id, { status: "completed" })

          const updated = await adapter.getFlowNode(child1Id)
          expect(updated?.status).toBe("completed")
        })

        it("should update result and completedAt", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, child1Id } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          const completedAt = new Date()
          await adapter.updateFlowNode(child1Id, {
            status: "completed",
            result: { output: "success" },
            completedAt,
          })

          const updated = await adapter.getFlowNode(child1Id)
          expect(updated?.status).toBe("completed")
          expect(updated?.result).toEqual({ output: "success" })
          expect(updated?.completedAt).toBeTruthy()
        })

        it("should update error", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, child1Id } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          await adapter.updateFlowNode(child1Id, {
            status: "failed",
            error: { name: "Error", message: "something went wrong" },
          })

          const updated = await adapter.getFlowNode(child1Id)
          expect(updated?.status).toBe("failed")
          expect(updated?.error?.message).toBe("something went wrong")
        })

        it("should update jobId", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          const jobId = crypto.randomUUID()
          await adapter.updateFlowNode(parentId, {
            status: "ready",
            jobId,
          })

          const updated = await adapter.getFlowNode(parentId)
          expect(updated?.status).toBe("ready")
          expect(updated?.jobId).toBe(jobId)
        })
      })

      // ─── incrementNodeChildrenCompleted ─────────────────────────────────

      describe("incrementNodeChildrenCompleted", () => {
        it("should increment and return updated counts", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          const result = await adapter.incrementNodeChildrenCompleted(parentId)
          expect(result.completed).toBe(1)
          expect(result.total).toBe(2)
        })

        it("should handle multiple increments correctly", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          await adapter.incrementNodeChildrenCompleted(parentId)
          const result = await adapter.incrementNodeChildrenCompleted(parentId)

          expect(result.completed).toBe(2)
          expect(result.total).toBe(2)
        })
      })

      // ─── getNodeChildren ──────────────────────────────────────────────────

      describe("getNodeChildren", () => {
        it("should return direct children only", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId, child1Id, child2Id } =
            createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          const children = await adapter.getNodeChildren(parentId)
          expect(children).toHaveLength(2)
          const childIds = children.map((c) => c.id)
          expect(childIds).toContain(child1Id)
          expect(childIds).toContain(child2Id)
        })

        it("should return empty array for leaf nodes", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, child1Id } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          const children = await adapter.getNodeChildren(child1Id)
          expect(children).toHaveLength(0)
        })
      })

      // ─── getChildrenResults / getFailedChildrenResults ─────────────────

      describe("getChildrenResults / getFailedChildrenResults", () => {
        it("should return results of completed children", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId, child1Id, child2Id } =
            createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          // Mark children as completed with results
          await adapter.updateFlowNode(child1Id, {
            status: "completed",
            result: { value: 1 },
            completedAt: new Date(),
          })
          await adapter.updateFlowNode(child2Id, {
            status: "completed",
            result: { value: 2 },
            completedAt: new Date(),
          })

          const results = await adapter.getChildrenResults(parentId)
          expect(results.size).toBe(2)
          expect(results.get(child1Id)).toEqual({ value: 1 })
          expect(results.get(child2Id)).toEqual({ value: 2 })
        })

        it("should return errors of failed children", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId, child1Id, child2Id } =
            createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          await adapter.updateFlowNode(child1Id, {
            status: "failed",
            error: { name: "Error", message: "fail 1" },
          })
          await adapter.updateFlowNode(child2Id, {
            status: "completed",
            result: { ok: true },
            completedAt: new Date(),
          })

          const errors = await adapter.getFailedChildrenResults(parentId)
          expect(errors.size).toBe(1)
          expect(errors.get(child1Id)).toEqual({
            name: "Error",
            message: "fail 1",
          })
        })

        it("should return empty map when no matching children", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          // Children are still in "ready" status, not completed or failed
          const results = await adapter.getChildrenResults(parentId)
          expect(results.size).toBe(0)

          const errors = await adapter.getFailedChildrenResults(parentId)
          expect(errors.size).toBe(0)
        })
      })

      // ─── cancelUnprocessedChildren ─────────────────────────────────────

      describe("cancelUnprocessedChildren", () => {
        it("should cancel waiting children", async () => {
          const flowId = crypto.randomUUID()
          const parentId = crypto.randomUUID()
          const waitingChildId = crypto.randomUUID()
          const readyChildId = crypto.randomUUID()

          const nodes: NewFlowNode[] = [
            {
              id: parentId,
              flowId,
              queueName: "test-queue",
              name: "parent",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 2,
              childrenCompleted: 0,
            },
            {
              id: waitingChildId,
              flowId,
              parentNodeId: parentId,
              queueName: "test-queue",
              name: "waiting-child",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 1,
              childrenCompleted: 0,
            },
            {
              id: readyChildId,
              flowId,
              parentNodeId: parentId,
              queueName: "test-queue",
              name: "ready-child",
              payload: {},
              status: "ready",
              failureStrategy: "default",
              childrenCount: 0,
              childrenCompleted: 0,
              jobId: crypto.randomUUID(),
            },
          ]

          const leafJobs: NewJob[] = [
            {
              name: "ready-child",
              payload: {},
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 3,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              flowNodeId: readyChildId,
            },
          ]

          await adapter.createFlow(nodes, leafJobs)

          const cancelled = await adapter.cancelUnprocessedChildren(parentId)
          expect(cancelled).toBeGreaterThanOrEqual(1)

          const waitingChild = await adapter.getFlowNode(waitingChildId)
          expect(waitingChild?.status).toBe("cancelled")
        })

        it("should cancel ready children with pending jobs", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId, child1Id } =
            createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          const cancelled = await adapter.cancelUnprocessedChildren(parentId)
          expect(cancelled).toBeGreaterThanOrEqual(1)

          const child = await adapter.getFlowNode(child1Id)
          expect(child?.status).toBe("cancelled")
        })

        it("should not cancel active or completed children", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId, child1Id, child2Id } =
            createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          // Mark child1 as completed
          await adapter.updateFlowNode(child1Id, {
            status: "completed",
            result: { done: true },
            completedAt: new Date(),
          })

          await adapter.cancelUnprocessedChildren(parentId)

          const completedChild = await adapter.getFlowNode(child1Id)
          expect(completedChild?.status).toBe("completed")

          // child2 should be cancelled (was ready with pending job)
          const cancelledChild = await adapter.getFlowNode(child2Id)
          expect(cancelledChild?.status).toBe("cancelled")
        })

        it("should recursively cancel subtrees", async () => {
          const flowId = crypto.randomUUID()
          const rootId = crypto.randomUUID()
          const childId = crypto.randomUUID()
          const grandchildId = crypto.randomUUID()

          const nodes: NewFlowNode[] = [
            {
              id: rootId,
              flowId,
              queueName: "test-queue",
              name: "root",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 1,
              childrenCompleted: 0,
            },
            {
              id: childId,
              flowId,
              parentNodeId: rootId,
              queueName: "test-queue",
              name: "child",
              payload: {},
              status: "waiting",
              failureStrategy: "default",
              childrenCount: 1,
              childrenCompleted: 0,
            },
            {
              id: grandchildId,
              flowId,
              parentNodeId: childId,
              queueName: "test-queue",
              name: "grandchild",
              payload: {},
              status: "ready",
              failureStrategy: "default",
              childrenCount: 0,
              childrenCompleted: 0,
              jobId: crypto.randomUUID(),
            },
          ]

          const leafJobs: NewJob[] = [
            {
              name: "grandchild",
              payload: {},
              status: "pending",
              priority: 2,
              attempts: 0,
              maxAttempts: 3,
              processAt: new Date(),
              progress: 0,
              repeatCount: 0,
              flowNodeId: grandchildId,
            },
          ]

          await adapter.createFlow(nodes, leafJobs)

          await adapter.cancelUnprocessedChildren(rootId)

          const child = await adapter.getFlowNode(childId)
          const grandchild = await adapter.getFlowNode(grandchildId)
          expect(child?.status).toBe("cancelled")
          expect(grandchild?.status).toBe("cancelled")
        })
      })

      // ─── deleteFlow ──────────────────────────────────────────────────────

      describe("deleteFlow", () => {
        it("should delete all nodes in a flow", async () => {
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId, child1Id, child2Id } =
            createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)

          const count = await adapter.deleteFlow(flowId)
          expect(count).toBe(3)

          // Verify nodes are gone
          expect(await adapter.getFlowNode(parentId)).toBeNull()
          expect(await adapter.getFlowNode(child1Id)).toBeNull()
          expect(await adapter.getFlowNode(child2Id)).toBeNull()
        })

        it("should return count of deleted nodes", async () => {
          const flowId = crypto.randomUUID()
          const nodeId = crypto.randomUUID()
          await adapter.createFlow(
            [
              {
                id: nodeId,
                flowId,
                queueName: "test-queue",
                name: "single",
                payload: {},
                status: "ready",
                failureStrategy: "default",
                childrenCount: 0,
                childrenCompleted: 0,
                jobId: crypto.randomUUID(),
              },
            ],
            [
              {
                name: "single",
                payload: {},
                status: "pending",
                priority: 2,
                attempts: 0,
                maxAttempts: 3,
                processAt: new Date(),
                progress: 0,
                repeatCount: 0,
                flowNodeId: nodeId,
              },
            ]
          )

          const count = await adapter.deleteFlow(flowId)
          expect(count).toBe(1)
        })
      })

      // ─── cleanupFlows ────────────────────────────────────────────────────

      describe("cleanupFlows", () => {
        it("should keep only N most recent completed flows", async () => {
          // Create 4 completed flows
          for (let i = 0; i < 4; i++) {
            const flowId = crypto.randomUUID()
            const nodeId = crypto.randomUUID()
            await adapter.createFlow(
              [
                {
                  id: nodeId,
                  flowId,
                  queueName: "test-queue",
                  name: `cleanup-${i}`,
                  payload: {},
                  status: "ready",
                  failureStrategy: "default",
                  childrenCount: 0,
                  childrenCompleted: 0,
                  jobId: crypto.randomUUID(),
                },
              ],
              [
                {
                  name: `cleanup-${i}`,
                  payload: {},
                  status: "pending",
                  priority: 2,
                  attempts: 0,
                  maxAttempts: 3,
                  processAt: new Date(),
                  progress: 0,
                  repeatCount: 0,
                  flowNodeId: nodeId,
                },
              ]
            )
            await adapter.updateFlowNode(nodeId, {
              status: "completed",
              completedAt: new Date(),
            })
            // Small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 50))
          }

          // Keep only 2 most recent
          const deleted = await adapter.cleanupFlows(2)
          expect(deleted).toBe(2)

          // Should have 2 remaining completed flows
          const remaining = await adapter.getFlows({ status: "completed" })
          expect(remaining).toHaveLength(2)
        })

        it("should not delete non-completed flows", async () => {
          // Create a waiting flow
          const waitingFlowId = crypto.randomUUID()
          const { nodes, leafJobs } = createSimpleFlowData(waitingFlowId)
          await adapter.createFlow(nodes, leafJobs)

          // Create 2 completed flows
          for (let i = 0; i < 2; i++) {
            const flowId = crypto.randomUUID()
            const nodeId = crypto.randomUUID()
            await adapter.createFlow(
              [
                {
                  id: nodeId,
                  flowId,
                  queueName: "test-queue",
                  name: `completed-${i}`,
                  payload: {},
                  status: "ready",
                  failureStrategy: "default",
                  childrenCount: 0,
                  childrenCompleted: 0,
                  jobId: crypto.randomUUID(),
                },
              ],
              [
                {
                  name: `completed-${i}`,
                  payload: {},
                  status: "pending",
                  priority: 2,
                  attempts: 0,
                  maxAttempts: 3,
                  processAt: new Date(),
                  progress: 0,
                  repeatCount: 0,
                  flowNodeId: nodeId,
                },
              ]
            )
            await adapter.updateFlowNode(nodeId, {
              status: "completed",
              completedAt: new Date(),
            })
            await new Promise((resolve) => setTimeout(resolve, 50))
          }

          // Keep only 1 completed flow — the waiting flow should remain
          const deleted = await adapter.cleanupFlows(1)
          expect(deleted).toBe(1)

          // The waiting flow should still exist
          const waitingFlows = await adapter.getFlows({ status: "waiting" })
          expect(waitingFlows).toHaveLength(1)
          expect(waitingFlows[0]?.flowId).toBe(waitingFlowId)
        })

        it("should return count of deleted nodes", async () => {
          // Create a completed flow with 3 nodes (1 parent, 2 children)
          const flowId = crypto.randomUUID()
          const { nodes, leafJobs, parentId } = createSimpleFlowData(flowId)
          await adapter.createFlow(nodes, leafJobs)
          await adapter.updateFlowNode(parentId, {
            status: "completed",
            completedAt: new Date(),
          })

          // Cleanup keeping 0 flows (delete all completed)
          const deleted = await adapter.cleanupFlows(0)
          expect(deleted).toBe(3)
        })
      })
    }
  )
}
