---
"@vorsteh-queue/core": major
"@vorsteh-queue/adapter-drizzle": major
"@vorsteh-queue/adapter-prisma": major
"@vorsteh-queue/adapter-kysely": major
"@vorsteh-queue/adapter-zenstack": major
"@vorsteh-queue/adapter-typeorm": major
"@vorsteh-queue/adapter-mikroorm": major
"@vorsteh-queue/adapter-sequelize": major
"@vorsteh-queue/shared-tests": major
---

## FlowProducer V1

Redesigned the flow system with a clean separation between flow orchestration and job processing.

### Breaking Changes

- Removed `waiting-children` from `JobStatus` and `STATE_TRANSITIONS`
- Removed flow fields from `Job` interface: `parentId`, `flowId`, `childrenCount`, `childrenCompleted`, `failParentOnFailure`
- Removed `dependsOn` and `onDependencyFailure` from `Job` and `JobOptions`
- Removed `dependencies.ts` module (`detectCircularDependencies`, `areDependenciesMet`, etc.)
- Removed flow methods from `QueueAdapter`: `getFlowTree`, `deleteFlow`, `incrementChildrenCompleted`, `getChildrenJobs`, `getFlows`
- Removed flow methods from `Queue` class: `addFlow`, `getFlowTree`, `createFlowNode`
- Removed `getChildrenResults` from `JobContext`

### New Features

- `FlowProducer` class for creating and managing multi-step job flows
- `FlowAdapter` interface for flow persistence (separate from `QueueAdapter`)
- 2-table architecture: `queue_flows` table for orchestration, `queue_jobs` for work
- Parent jobs only created after all direct children reach terminal state
- Three failure strategies: `default`, `fail-parent`, `continue-parent`
- `FlowJobContext` in parent handlers: `getChildrenValues`, `getFailedChildrenValues`, `getChildrenValuesBy`, `removeUnprocessedChildren`
- Flow events: `flow:created`, `flow:completed`, `flow:failed`, `flow:node:promoted`
- Convenience methods: `addChain` (sequential), `addBulkThen` (fan-in)
- Configurable flow cleanup via `removeOnComplete`
- Cross-queue flow support
