/**
 * FlowProducer class.
 *
 * Creates and manages multi-step job flows with parent-child relationships.
 * Jobs in a flow are orchestrated through a separate `queue_flows` table,
 * ensuring that parent jobs are only created when their children complete.
 *
 * All flow nodes must reside in the same database schema. The `queueName` field
 * on each node determines which queue processes the job, but all flow orchestration
 * data (the `queue_flows` table) is stored in a single schema alongside `queue_jobs`.
 * Cross-database flows are not supported.
 *
 * @example
 * ```typescript
 * const flowProducer = new FlowProducer(adapter)
 *
 * const flow = await flowProducer.add({
 *   name: "send-report",
 *   queueName: "emails",
 *   payload: { to: "user@example.com" },
 *   children: [
 *     { name: "generate-pdf", queueName: "reports", payload: { id: 123 } },
 *     { name: "fetch-data", queueName: "data", payload: { query: "sales" } },
 *   ],
 * })
 * ```
 */

import { TypedEventEmitter } from "./events"
import type {
  FlowAdapter,
  FlowBulkThenResult,
  FlowChainResult,
  FlowChainStep,
  FlowJobDefinition,
  FlowListOptions,
  FlowNode,
  FlowProducerConfig,
  FlowProducerEvents,
  FlowResult,
  FlowSummary,
  FlowTree,
  NewFlowNode,
} from "./flow-types"
import type { Telemetry } from "./telemetry"
import { noopTelemetry } from "./telemetry"
import type { NewJob, QueueAdapter } from "./types"

export class FlowProducer extends TypedEventEmitter<FlowProducerEvents> {
  private readonly _adapter: FlowAdapter & QueueAdapter
  private readonly _config: Required<
    Pick<FlowProducerConfig, "removeOnComplete">
  >
  private readonly _telemetry: Telemetry

  /**
   * Create a new FlowProducer instance.
   *
   * @param adapter - Combined adapter implementing both FlowAdapter and QueueAdapter
   * @param config - Optional configuration for flow cleanup and telemetry
   */
  constructor(
    adapter: FlowAdapter & QueueAdapter,
    config?: FlowProducerConfig
  ) {
    super()
    this._adapter = adapter
    this._config = {
      removeOnComplete: config?.removeOnComplete ?? 100,
    }
    this._telemetry = config?.telemetry ?? noopTelemetry
  }

  /**
   * Create a parent-child flow tree. Children complete before their parent is promoted.
   *
   * Leaf nodes (no children) immediately create jobs in `queue_jobs`.
   * Parent nodes (with children) wait until all direct children reach a terminal state.
   * All nodes and leaf jobs are created atomically in a single transaction.
   *
   * @param definition - The flow tree definition
   * @returns The flow ID and root node
   *
   * @example
   * ```typescript
   * const flow = await flowProducer.add({
   *   name: "send-report",
   *   queueName: "emails",
   *   payload: { to: "user@example.com" },
   *   children: [
   *     { name: "generate-pdf", queueName: "reports", payload: { id: 123 } },
   *     { name: "fetch-data", queueName: "data", payload: { query: "sales" } },
   *   ],
   * })
   * ```
   */
  async add(definition: FlowJobDefinition): Promise<FlowResult> {
    const flowId = crypto.randomUUID()
    const nodes: NewFlowNode[] = []
    const leafJobs: NewJob[] = []

    this._buildTree(definition, flowId, undefined, nodes, leafJobs)

    const createdNodes = await this._adapter.createFlow(nodes, leafJobs)

    const rootNode = createdNodes.find((node) => !node.parentNodeId)
    if (!rootNode) {
      throw new Error("Flow creation failed: root node not found in result")
    }

    const result: FlowResult = { flowId, rootNode }
    this.emit("flow:created", result)
    this._telemetry.flowCreated(flowId)
    return result
  }

  /**
   * Create a sequential chain where steps execute in order.
   *
   * Transforms `[A, B, C]` into a nested parent-child tree where the deepest
   * node (leaf) runs first, and the root runs last:
   *
   * ```
   * C (root — runs last)
   * └── B
   *     └── A (leaf — runs first)
   * ```
   *
   * @param steps - Sequential steps in execution order (first element runs first)
   * @returns The flow ID and nodes in execution order
   * @throws {Error} If steps is empty
   *
   * @example
   * ```typescript
   * const chain = await flowProducer.addChain([
   *   { name: "fetch-data", queueName: "data", payload: { id: 1 } },
   *   { name: "transform", queueName: "etl", payload: {} },
   *   { name: "upload", queueName: "storage", payload: { bucket: "out" } },
   * ])
   * // fetch-data runs first, then transform, then upload
   * ```
   */
  async addChain(steps: readonly FlowChainStep[]): Promise<FlowChainResult> {
    if (steps.length === 0) {
      throw new Error("addChain requires at least 1 step")
    }

    // Build nested definition: last step is root, first step is deepest leaf
    let definition: FlowJobDefinition | undefined

    for (const step of steps) {
      const node: FlowJobDefinition = {
        name: step.name,
        queueName: step.queueName,
        payload: step.payload,
        options: step.options,
        ...(definition ? { children: [definition] } : {}),
      }
      definition = node
    }

    // Safety: guaranteed by steps.length > 0 check above
    if (!definition) {
      throw new Error("addChain requires at least 1 step")
    }

    const { flowId } = await this.add(definition)

    // Retrieve the full tree and walk the chain from root to leaf
    const tree = await this._adapter.getFlowTree(flowId)
    if (!tree) {
      throw new Error("Flow creation failed: could not retrieve flow tree")
    }

    const nodes: FlowNode[] = []
    let current: FlowTree | undefined = tree

    while (current) {
      nodes.push(current.node)
      ;[current] = current.children
    }

    // nodes is root-to-leaf (last-to-first execution), reverse for execution order
    nodes.reverse()

    return { flowId, nodes }
  }

  /**
   * Create a fan-in flow where parallel jobs complete before a final job runs.
   *
   * Transforms `[A, B, C]` and `D` into:
   *
   * ```
   * D (root — runs after all parallel jobs complete)
   * ├── A (leaf)
   * ├── B (leaf)
   * └── C (leaf)
   * ```
   *
   * @param parallel - Steps to run in parallel (become children/leaf nodes)
   * @param final - Step that runs after all parallel steps complete (becomes root)
   * @returns The flow ID, parallel nodes, and final node
   * @throws {Error} If parallel is empty
   *
   * @example
   * ```typescript
   * const result = await flowProducer.addBulkThen(
   *   [
   *     { name: "fetch-users", queueName: "data", payload: { type: "users" } },
   *     { name: "fetch-orders", queueName: "data", payload: { type: "orders" } },
   *     { name: "fetch-products", queueName: "data", payload: { type: "products" } },
   *   ],
   *   { name: "generate-report", queueName: "reports", payload: { format: "pdf" } },
   * )
   * // fetch-users, fetch-orders, fetch-products run in parallel
   * // generate-report runs after all three complete
   * ```
   */
  async addBulkThen(
    parallel: readonly FlowChainStep[],
    final: FlowChainStep
  ): Promise<FlowBulkThenResult> {
    if (parallel.length === 0) {
      throw new Error("addBulkThen requires at least 1 parallel step")
    }

    const definition: FlowJobDefinition = {
      name: final.name,
      queueName: final.queueName,
      payload: final.payload,
      options: final.options,
      children: parallel.map((step) => ({
        name: step.name,
        queueName: step.queueName,
        payload: step.payload,
        options: step.options,
      })),
    }

    const { flowId } = await this.add(definition)

    const tree = await this._adapter.getFlowTree(flowId)
    if (!tree) {
      throw new Error("Flow creation failed: could not retrieve flow tree")
    }

    const finalNode = tree.node
    const parallelNodes = tree.children.map((child) => child.node)

    return { flowId, parallelNodes, finalNode }
  }

  /**
   * Get a flow tree by ID.
   *
   * @param flowId - The unique flow identifier
   * @returns The full flow tree or null if not found
   */
  async getFlow(flowId: string): Promise<FlowTree | null> {
    return this._adapter.getFlowTree(flowId)
  }

  /**
   * List flows with pagination and status filter.
   *
   * @param options - Optional filtering and pagination options
   * @returns Array of flow summaries
   */
  async getFlows(options?: FlowListOptions): Promise<readonly FlowSummary[]> {
    return this._adapter.getFlows(options)
  }

  /**
   * The flow cleanup configuration.
   *
   * Controls whether completed flows are removed automatically:
   * - `true` — delete all completed flows immediately
   * - `false` — keep flows indefinitely
   * - `number` — keep only the N most recent completed flows
   */
  get removeOnComplete(): boolean | number {
    return this._config.removeOnComplete
  }

  /**
   * Clean up completed flows based on the removeOnComplete configuration.
   * Called internally after a flow root node's job completes.
   *
   * - `true`: delete all completed flows immediately (keep 0)
   * - `false`: keep all flows indefinitely
   * - `number`: keep only the N most recent completed flows
   */
  async cleanupCompletedFlows(): Promise<void> {
    const { removeOnComplete } = this._config

    if (removeOnComplete === false) {
      return
    }

    await this._adapter.cleanupFlows(
      removeOnComplete === true ? 0 : removeOnComplete
    )
  }

  /**
   * Recursively walk a FlowJobDefinition tree to build flat arrays of
   * NewFlowNode and NewJob entries.
   *
   * Each node gets a pre-generated UUID used as `parentNodeId` reference
   * for its children, and as `flowNodeId` on its leaf job. The adapter
   * uses these UUIDs to establish parent-child relationships when persisting.
   */
  private _buildTree(
    definition: FlowJobDefinition,
    flowId: string,
    parentNodeId: string | undefined,
    nodes: NewFlowNode[],
    leafJobs: NewJob[]
  ): void {
    const nodeId = crypto.randomUUID()
    const children = definition.children ?? []
    const isLeaf = children.length === 0

    nodes.push({
      id: nodeId,
      flowId,
      parentNodeId,
      jobId: undefined,
      queueName: definition.queueName,
      name: definition.name,
      payload: definition.payload,
      options: definition.options,
      status: isLeaf ? "ready" : "waiting",
      failureStrategy: definition.failureStrategy ?? "default",
      childrenCount: children.length,
      childrenCompleted: 0,
    })

    if (isLeaf) {
      leafJobs.push({
        name: definition.name,
        payload: definition.payload,
        status: "pending",
        priority: definition.options?.priority ?? 2,
        attempts: 0,
        maxAttempts: definition.options?.maxAttempts ?? 3,
        processAt: new Date(),
        progress: 0,
        repeatCount: 0,
        timeout: definition.options?.timeout,
        flowNodeId: nodeId,
        groupKey: definition.options?.group,
        uniqueKey: definition.options?.unique?.key,
      })
    }

    for (const child of children) {
      this._buildTree(child, flowId, nodeId, nodes, leafJobs)
    }
  }
}
