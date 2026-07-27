# FlowProducer V1 — Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Code                            │
├─────────────────────────────────────────────────────────────┤
│  FlowProducer         Queue              Worker             │
│  ─────────────        ─────              ──────             │
│  add()                add()              register()         │
│  addChain()           cancel()           start() / stop()   │
│  addBulkThen()        getStats()         promotes flow nodes │
│  getFlow()                               after job complete  │
│  getFlows()                                                 │
├─────────────────────────────────────────────────────────────┤
│                    FlowAdapter + QueueAdapter                │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐                       │
│  │ queue_flows   │    │ queue_jobs    │   (same DB/schema)   │
│  └──────────────┘    └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### `queue_flows` table

| Column | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | UUID | gen_random_uuid() | Primary key |
| `flow_id` | UUID | NOT NULL | Groups all nodes in a flow |
| `parent_node_id` | UUID / NULL | NULL | FK to `queue_flows.id` — tree structure |
| `job_id` | UUID / NULL | NULL | FK to `queue_jobs.id` — set when node is promoted |
| `queue_name` | VARCHAR(255) | NOT NULL | Target queue for this node's job |
| `name` | VARCHAR(255) | NOT NULL | Handler name |
| `payload` | JSONB | NOT NULL | Job payload (stored until job creation) |
| `options` | JSONB / NULL | NULL | JobOptions (priority, timeout, etc.) |
| `status` | VARCHAR(50) | NOT NULL | `waiting`, `ready`, `completed`, `failed`, `cancelled` |
| `failure_strategy` | VARCHAR(20) | `'default'` | `default`, `fail-parent`, `continue-parent` |
| `children_count` | INT | 0 | Number of direct children |
| `children_completed` | INT | 0 | Direct children that reached terminal state |
| `result` | JSONB / NULL | NULL | Job result after completion |
| `error` | JSONB / NULL | NULL | Error info when failed |
| `created_at` | TIMESTAMPTZ | now() | Creation timestamp |
| `completed_at` | TIMESTAMPTZ / NULL | NULL | When node reached terminal state |

**Indexes:**

- `idx_queue_flows_flow_id` ON (`flow_id`)
- `idx_queue_flows_parent_node_id` ON (`parent_node_id`)
- `idx_queue_flows_job_id` ON (`job_id`) — for Worker lookup after job completes
- `idx_queue_flows_status` ON (`flow_id`, `status`)

### `queue_jobs` table changes

**Removed columns:**

- `parent_id`
- `flow_id`
- `children_count`
- `children_completed`
- `fail_parent_on_failure`
- `depends_on`
- `on_dependency_failure`

**Added column:**

- `flow_node_id` UUID / NULL — backlink to `queue_flows.id`

## Flow Node Status Lifecycle

```
┌──────────┐     All children terminal     ┌───────┐     Job created     ┌───────────┐
│ waiting  │ ────────────────────────────── │ ready │ ──────────────────  │ completed │
└──────────┘                                └───────┘                     └───────────┘
     │                                          │
     │ fail-parent cascade                      │ Job handler fails
     │ OR all children terminal with error      │ (terminal failure)
     ▼                                          ▼
┌──────────┐                                ┌──────────┐
│  failed  │                                │  failed  │
└──────────┘                                └──────────┘

     │ removeUnprocessedChildren
     ▼
┌───────────┐
│ cancelled │
└───────────┘
```

**Status definitions:**

- `waiting` — Node is waiting for children to complete (parent nodes start here)
- `ready` — Node has been promoted; a job exists in `queue_jobs` (leaf nodes start here)
- `completed` — Node's job completed successfully
- `failed` — Node failed (handler failure, or `fail-parent` cascade with no job created)
- `cancelled` — Node was cancelled via `removeUnprocessedChildren()`

## Core Interfaces

### FlowAdapter

```typescript
/** Persistence interface for flow orchestration data. */
interface FlowAdapter {
  /** Create all flow nodes (and leaf jobs) in a single transaction. */
  createFlow(
    nodes: readonly NewFlowNode[],
    leafJobs: readonly NewJob[]
  ): Promise<readonly FlowNode[]>

  /** Get a flow node by ID. */
  getFlowNode(nodeId: string): Promise<FlowNode | null>

  /** Get the full flow tree by flow ID. */
  getFlowTree(flowId: string): Promise<FlowTree | null>

  /** List flows with pagination and optional status filter. */
  getFlows(options?: FlowListOptions): Promise<readonly FlowSummary[]>

  /** Update a flow node's status and optional metadata. */
  updateFlowNode(nodeId: string, update: FlowNodeUpdate): Promise<void>

  /** Increment children_completed on a parent node. Returns updated counts. */
  incrementNodeChildrenCompleted(
    nodeId: string
  ): Promise<{ completed: number; total: number }>

  /** Get direct children of a node. */
  getNodeChildren(nodeId: string): Promise<readonly FlowNode[]>

  /** Get results of all completed child nodes. */
  getChildrenResults(nodeId: string): Promise<ReadonlyMap<string, unknown>>

  /** Get errors of all failed child nodes. */
  getFailedChildrenResults(
    nodeId: string
  ): Promise<ReadonlyMap<string, unknown>>

  /** Cancel all unprocessed children (pending/delayed jobs) and their subtrees. */
  cancelUnprocessedChildren(nodeId: string): Promise<number>

  /** Delete all nodes in a flow. */
  deleteFlow(flowId: string): Promise<number>

  /** Cleanup completed flows, keeping only N most recent. */
  cleanupFlows(keepCount: number): Promise<number>
}
```

### Flow Types

```typescript
/** Status of a flow node. */
type FlowNodeStatus = "waiting" | "ready" | "completed" | "failed" | "cancelled"

/** Failure strategy for a child node. */
type FlowFailureStrategy = "default" | "fail-parent" | "continue-parent"

/** A flow node record as stored in the database. */
interface FlowNode {
  readonly id: string
  readonly flowId: string
  readonly parentNodeId?: string
  readonly jobId?: string
  readonly queueName: string
  readonly name: string
  readonly payload: unknown
  readonly options?: JobOptions
  readonly status: FlowNodeStatus
  readonly failureStrategy: FlowFailureStrategy
  readonly childrenCount: number
  readonly childrenCompleted: number
  readonly result?: unknown
  readonly error?: SerializedError
  readonly createdAt: Date
  readonly completedAt?: Date
}

/** Input for creating a flow node (no id/createdAt). */
type NewFlowNode = Omit<
  FlowNode,
  "id" | "createdAt" | "completedAt" | "result" | "error"
>

/** Tree representation returned by getFlowTree. */
interface FlowTree {
  readonly node: FlowNode
  readonly children: readonly FlowTree[]
}

/** Summary for flow listing. */
interface FlowSummary {
  readonly flowId: string
  readonly rootNode: FlowNode
  readonly status: FlowNodeStatus
  readonly createdAt: Date
  readonly completedAt?: Date
}

/** Options for listing flows. */
interface FlowListOptions {
  readonly status?: FlowNodeStatus
  readonly limit?: number
  readonly offset?: number
}
```

### FlowProducer Input Types

```typescript
/** Input for flowProducer.add() — defines a node in the flow tree. */
interface FlowJobDefinition {
  readonly name: string
  readonly queueName: string
  readonly payload: unknown
  readonly options?: JobOptions
  readonly failureStrategy?: FlowFailureStrategy
  readonly children?: readonly FlowJobDefinition[]
}

/** Input for flowProducer.addChain() — a sequential step. */
interface FlowChainStep {
  readonly name: string
  readonly queueName: string
  readonly payload: unknown
  readonly options?: JobOptions
}

/** Result of flow creation. */
interface FlowResult {
  readonly flowId: string
  readonly rootNode: FlowNode
}

/** Result of addChain. */
interface FlowChainResult {
  readonly flowId: string
  readonly nodes: readonly FlowNode[]
}

/** Result of addBulkThen. */
interface FlowBulkThenResult {
  readonly flowId: string
  readonly parallelNodes: readonly FlowNode[]
  readonly finalNode: FlowNode
}
```

## FlowProducer Class

```typescript
class FlowProducer extends TypedEventEmitter<FlowProducerEvents> {
  constructor(adapter: FlowAdapter & QueueAdapter, config?: FlowProducerConfig)

  /** Create a parent-child tree. Children complete before parent. */
  async add(definition: FlowJobDefinition): Promise<FlowResult>

  /** Create a sequential chain. A → B → C. */
  async addChain(steps: readonly FlowChainStep[]): Promise<FlowChainResult>

  /** Create a fan-in flow. [A, B, C] → D. */
  async addBulkThen(
    parallel: readonly FlowChainStep[],
    final: FlowChainStep
  ): Promise<FlowBulkThenResult>

  /** Get a flow tree by ID. */
  async getFlow(flowId: string): Promise<FlowTree | null>

  /** List flows with pagination and status filter. */
  async getFlows(options?: FlowListOptions): Promise<readonly FlowSummary[]>
}
```

**Config:**

```typescript
interface FlowProducerConfig {
  /** Remove completed flows: true = immediate, number = keep N.
   * @default 100
   */
  readonly removeOnComplete?: boolean | number
}
```

**Events:**

```typescript
interface FlowProducerEvents {
  "flow:created": FlowResult
  "flow:completed": { flowId: string; result: unknown }
  "flow:failed": { flowId: string; error: SerializedError }
  "flow:node:promoted": { flowId: string; nodeId: string; jobId: string }
}
```

## Worker Integration

### How the Worker promotes flow nodes

After a job completes or fails terminally, the Worker checks if the job belongs to a flow:

```
Job completed/failed
  → Has flowNodeId? No → done
  → Yes: update flow_node (status, result/error)
  → Get parent_node_id from this flow_node
  → No parent? This is root → emit flow:completed/flow:failed, cleanup
  → Has parent: increment parent.children_completed
  → Check: is parent promotable?
    → All children terminal (completed/failed)? → promote parent
    → Child has "continue-parent" and just failed? → promote parent immediately
    → Child has "fail-parent" and just failed? → fail parent (no job), cascade up
```

### Promotion logic

When a parent node is promoted:

1. Create a real job in `queue_jobs` with `flowNodeId` set
2. Set flow_node.status = `"ready"`, flow_node.job_id = new job ID
3. Emit `flow:node:promoted`

### JobContext additions (FlowJobContext)

```typescript
/** Filter criteria for querying children of a flow node. */
interface ChildrenFilter {
  /** Filter by child node name(s). */
  readonly name?: string | readonly string[]
  /** Filter by child node status(es). */
  readonly status?: FlowNodeStatus | readonly FlowNodeStatus[]
}

/** Value returned per child node from getChildrenValuesBy. */
interface ChildNodeValue {
  readonly nodeId: string
  readonly name: string
  readonly status: "completed" | "failed" | "cancelled"
  readonly result?: unknown
  readonly error?: SerializedError
}

interface FlowJobContext {
  /** Results of completed children. Shortcut for getChildrenValuesBy({ status: "completed" }). */
  getChildrenValues: () => Promise<ReadonlyMap<string, unknown>>

  /** Errors from failed children. Shortcut for getChildrenValuesBy({ status: "failed" }). */
  getFailedChildrenValues: () => Promise<ReadonlyMap<string, SerializedError>>

  /** Flexible query for children by filter criteria. */
  getChildrenValuesBy: (
    filter: ChildrenFilter
  ) => Promise<ReadonlyMap<string, ChildNodeValue>>

  /** Cancel all unprocessed children and their subtrees. */
  removeUnprocessedChildren: () => Promise<number>
}
```

Internally, `getChildrenValues()` delegates to `getChildrenValuesBy({ status: "completed" })` and extracts only the `result` field. `getFailedChildrenValues()` delegates to `getChildrenValuesBy({ status: "failed" })` and extracts only the `error` field.

The `ChildrenFilter` object is extensible — additional filter fields (e.g. `queueName`) can be added in the future without breaking changes.

These methods are only populated when the job has a `flowNodeId`. For non-flow jobs they return empty maps / 0.

## addChain and addBulkThen internals

### addChain([A, B, C])

Transforms into a nested parent-child tree (deepest = first to run):

```
C (root — runs last)
└── B
    └── A (leaf — runs first)
```

This is the same pattern BullMQ uses for sequential chains.

### addBulkThen([A, B, C], D)

Transforms into:

```
D (root — runs after all parallel jobs complete)
├── A (leaf)
├── B (leaf)
└── C (leaf)
```

This is a simple parent with multiple children.

## Changes to Existing Code

### Job interface (removals)

```diff
interface Job {
  // ... kept fields ...
- readonly dependsOn?: readonly string[]
- readonly onDependencyFailure?: "fail" | "cancel"
- readonly parentId?: string
- readonly flowId?: string
- readonly childrenCount?: number
- readonly childrenCompleted?: number
- readonly failParentOnFailure?: boolean
+ readonly flowNodeId?: string
}
```

### JobStatus (removal)

```diff
type JobStatus =
  | "pending"
  | "delayed"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "dead"
- | "waiting-children"
```

### STATE_TRANSITIONS (removal)

```diff
const STATE_TRANSITIONS = {
  // ...
- "waiting-children": ["pending", "cancelled", "failed"],
}
```

### QueueStats (removal)

```diff
interface QueueStats {
  // ...
- readonly "waiting-children": number
}
```

### QueueAdapter (removals)

```diff
interface QueueAdapter {
  // ... kept methods ...
- getFlowTree: (flowId: string) => Promise<FlowNode | null>
- deleteFlow: (flowId: string) => Promise<number>
- incrementChildrenCompleted: (parentId: string) => Promise<{ completed: number; total: number }>
- getChildrenJobs: (parentId: string) => Promise<readonly Job[]>
- getFlows: (options?: PaginationOptions) => Promise<readonly { flowId: string; rootJob: Job }[]>
}
```

### Files to delete

- `packages/core/src/dependencies.ts` — entire module (circular detection, areDependenciesMet, cascadeDependencyFailure)

### Files to create

- `packages/core/src/flow-producer.ts` — FlowProducer class
- `packages/core/src/flow-types.ts` — Flow-specific type definitions (to keep types.ts manageable)

### Worker changes

- Remove `promoteParentIfReady` (replaced with new flow-aware promotion)
- Remove `failParentOnChildFailure`
- Remove `filterByDependencies` logic
- Add `promoteFlowNode` — new method that works against FlowAdapter
- Add `handleFlowNodeFailure` — handles fail-parent cascade

### Queue changes

- Remove `addFlow`, `getFlowTree`, `createFlowNode` methods
- Remove `detectCircularDependencies` import and usage

## Adapter Configuration

### Extended adapter props

```typescript
interface PrismaAdapterProps {
  modelName?: string // default "QueueJob"
  tableName?: string // default "queue_jobs"
  schemaName?: string // default undefined (public)
  flowModelName?: string // default "QueueFlow"
  flowTableName?: string // default "queue_flows"
}

interface KyselyAdapterProps {
  tableName?: string // default "queue_jobs"
  schemaName?: string // default "public"
  flowTableName?: string // default "queue_flows"
}

interface DrizzleAdapterProps {
  modelName?: string // default "queueJobs"
  flowModelName?: string // default "queueFlows"
}

interface ZenstackAdapterProps {
  modelName?: string // default "queueJob"
  tableName?: string // default "queue_jobs"
  schemaName?: string // default undefined (public)
  flowModelName?: string // default "queueFlow"
  flowTableName?: string // default "queue_flows"
}

interface TypeormAdapterProps {
  tableName?: string // default "queue_jobs"
  schemaName?: string // default undefined (public)
  flowTableName?: string // default "queue_flows"
}

interface MikroormAdapterProps {
  tableName?: string // default "queue_jobs"
  schemaName?: string // default undefined (public)
  flowTableName?: string // default "queue_flows"
}

interface SequelizeAdapterProps {
  tableName?: string // default "queue_jobs"
  schemaName?: string // default undefined (public)
  flowTableName?: string // default "queue_flows"
}
```

## Migration Path (for documentation)

Since Flows, `dependsOn`, and `waiting-children` never existed in a published V0 release, there is no user-facing migration from old flow APIs.

The V1 migration guide for users only needs:

1. Add column to `queue_jobs`: `flow_node_id UUID NULL`
2. Create the `queue_flows` table (schema provided by each adapter package)
3. Remove any columns that were added during the refactor branch but never shipped: `parent_id`, `flow_id`, `children_count`, `children_completed`, `fail_parent_on_failure`, `depends_on`, `on_dependency_failure`
