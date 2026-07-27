# FlowProducer V1 — Requirements

## Context

The current flow implementation in vorsteh-queue treats flow parents as regular jobs with a `waiting-children` status. This leads to problems:

- Parent jobs inherit default retry/timeout settings (maxAttempts: 3, timeout: 30000) which make no sense for a job that only waits for children.
- Flow state is mixed into the job table, creating entries that no worker ever picks up.
- The `dependsOn` / `onDependencyFailure` fields on jobs overlap with flow functionality.

This spec redesigns the flow system to cleanly separate flow orchestration from job processing.

## Functional Requirements

### FR-1: FlowProducer as a separate class

The `FlowProducer` must be a standalone class exported from `@vorsteh-queue/core`. It must not be part of the `Queue` class.

### FR-2: 2-table architecture

Flow orchestration data must live in a separate `queue_flows` table (default name). The `jobs` table must only contain actual work units. The `waiting-children` status must be removed from the job state machine.

### FR-3: Parent jobs are not created until direct children complete

A parent flow node must not create a real job entry until all its **direct** children (not recursive) have reached a terminal state (completed/failed). Until then, it exists only as a `queue_flows` record. Grandchildren are tracked by their own parent nodes — promotion is always based on direct children only.

### FR-4: Leaf nodes create jobs immediately

Leaf nodes (no children) must create a real job in the `queue_jobs` table immediately when the flow is added. This happens within the same transaction as the flow node creation (see FR-6).

### FR-5: Cross-queue support

Each flow node must have a `queueName` property, allowing nodes in the same flow to target different queues.

### FR-6: Atomic flow creation

All flow nodes and their corresponding leaf jobs must be created in a single database transaction. If any part fails, the entire flow (both `queue_flows` entries and `queue_jobs` entries) is rolled back. This requires both tables to reside in the same database schema (see FR-16).

### FR-7: BullMQ-compatible API

- `flowProducer.add(tree)` — parent-child tree (children complete before parent)
- `flowProducer.addChain(steps)` — sequential execution (A → B → C)
- `flowProducer.addBulkThen(parallel, final)` — fan-in (parallel jobs → merge job)
- `flowProducer.getFlow(flowId)` — retrieve flow tree with status
- `flowProducer.getFlows(options)` — list flows with pagination and status filter

### FR-8: Failure strategies per child node

Each child node must support a `failureStrategy` option:

- `"default"` — Parent is promoted when ALL direct children reach a terminal state (completed or failed). Parent handler receives information about failed children via `ctx.getFailedChildrenValues()`.
- `"fail-parent"` — Parent flow node is immediately set to `failed` status. No job is created for the parent. The failure reason references the child that triggered it. Cascades recursively upward if ancestor nodes also have children with `"fail-parent"`.
- `"continue-parent"` — Parent is immediately promoted (job created), even while other children are still running. Parent handler decides what to do.

### FR-9: Parent handler context

When a parent job is created and processed, the handler context must provide:

- `ctx.getChildrenValues()` — results of completed children (convenience for `getChildrenValuesBy({ status: "completed" })`)
- `ctx.getFailedChildrenValues()` — errors from failed children (convenience for `getChildrenValuesBy({ status: "failed" })`)
- `ctx.getChildrenValuesBy(filter)` — flexible query accepting a filter object with optional `name` (string or array) and `status` (single or array of `"completed"`, `"failed"`, `"cancelled"`). Returns a map with nodeId, name, status, result, and error per child. The filter object is extensible for future fields.
- `ctx.removeUnprocessedChildren()` — cancel all children (and their subtrees) whose jobs are still in `pending`/`delayed` state. Active, completed, and failed children remain unaffected.

### FR-10: Remove `dependsOn` and `onDependencyFailure` from Job

These fields and their associated logic (the `dependencies.ts` module) must be removed. Job dependencies are expressed exclusively via flows or triggers.

### FR-11: Remove flow fields from Job interface

The following fields must be removed from `Job`:

- `parentId`
- `flowId`
- `childrenCount`
- `childrenCompleted`
- `failParentOnFailure`
- `waiting-children` status

A single `flowNodeId?: string` backlink remains for the worker to identify flow membership.

### FR-12: Remove `waiting-children` from state machine

The `JobStatus` type must only contain: `pending`, `delayed`, `processing`, `completed`, `failed`, `cancelled`, `dead`.

### FR-13: Separate `FlowAdapter` interface

The flow persistence methods must be defined in a dedicated `FlowAdapter` interface, separate from `QueueAdapter`. Concrete adapter classes implement both interfaces. Users who do not need flows only need to satisfy `QueueAdapter`.

### FR-14: Configurable table and model names

The `queue_flows` table name must be configurable per adapter:

- Drizzle: `flowTableName` option (default: `"queue_flows"`)
- Kysely: `flowTableName` option (default: `"queue_flows"`)
- Prisma: `flowTableName` + `flowModelName` options (defaults: `"queue_flows"` / `"QueueFlow"`)
- TypeORM: `flowTableName` option (default: `"queue_flows"`)
- MikroORM: `flowTableName` option (default: `"queue_flows"`)
- Sequelize: `flowTableName` option (default: `"queue_flows"`)
- ZenStack: `flowTableName` + `flowModelName` options (defaults: `"queue_flows"` / `"QueueFlow"`)

### FR-15: Default failure behavior promotes parent

When no explicit `failureStrategy` is set and a child fails terminally (no retries left), the parent is NOT blocked indefinitely. The parent is promoted once ALL direct children have reached a terminal state (completed or failed). The parent handler can then inspect `ctx.getFailedChildrenValues()` to determine partial success.

### FR-16: Same database, schema, and connection pool

The `queue_flows` table must reside in the same database AND the same schema as `queue_jobs`. They must share the same connection pool / client instance. This is a hard requirement to enable cross-table transactions (FR-6). This constraint must be documented clearly for users.

### FR-17: Flow lifecycle cleanup

Flow nodes must support configurable cleanup after the root node completes:

- `removeOnComplete: true` — delete all flow nodes immediately after root completion
- `removeOnComplete: false` — keep flow nodes indefinitely (for observability/audit)
- `removeOnComplete: number` — keep the N most recent completed flows, delete older ones

This mirrors the existing job cleanup behavior.

### FR-18: Flow events

The `FlowProducer` must emit events for observability:

- `flow:created` — when a new flow is created
- `flow:completed` — when the root node's job completes successfully
- `flow:failed` — when the root node is marked as failed (either via handler failure or `fail-parent` cascade)
- `flow:node:promoted` — when a parent node transitions from waiting to ready (job created)

## Non-Functional Requirements

### NFR-1: No backward compatibility required

Since this is a V1 breaking change, no backward compatibility with V0 flow APIs is required. Old code can be deleted directly.

### NFR-2: All 7 adapters must implement FlowAdapter

All adapter packages must implement the `FlowAdapter` interface:

- `@vorsteh-queue/adapter-drizzle`
- `@vorsteh-queue/adapter-prisma`
- `@vorsteh-queue/adapter-kysely`
- `@vorsteh-queue/adapter-zenstack`
- `@vorsteh-queue/adapter-typeorm`
- `@vorsteh-queue/adapter-mikroorm`
- `@vorsteh-queue/adapter-sequelize`

### NFR-3: Shared test coverage

The `shared-tests` package must contain flow tests that all adapters run.

### NFR-4: Documentation completeness

All public APIs must have JSDoc documentation following project conventions. The same-schema constraint (FR-16) must be prominently documented.

### NFR-5: Telemetry extension for Flows

The `Telemetry` interface (or a separate `FlowTelemetry` interface) must be extended to support flow-level observability:

- Metrics: flows created, completed, failed, active (gauge), duration (histogram), nodes promoted
- Tracing: a parent span per flow that links all child-job spans for end-to-end visibility

This can be implemented after the core flow logic is stable, but the design must not preclude it.

## Out of Scope

- DAGs (directed acyclic graphs) with arbitrary edges — only tree structures
- Dynamic child spawning after flow creation
- Flow-level retry (re-running entire flow on failure)
- The step engine (saga, sleep, waitFor) — stays as-is within individual jobs
