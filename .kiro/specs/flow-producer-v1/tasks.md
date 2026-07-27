# FlowProducer V1 — Implementation Tasks

## Phase 1: Core Cleanup (Remove old flow/dependency code)

- [x] 1. Remove `waiting-children` from `JobStatus` type and `STATE_TRANSITIONS` in `types.ts`
- [x] 2. Remove flow fields from `Job` interface: `parentId`, `flowId`, `childrenCount`, `childrenCompleted`, `failParentOnFailure`
- [x] 3. Remove `dependsOn` and `onDependencyFailure` from `Job` interface and `JobOptions`
- [x] 4. Remove `QueueStats["waiting-children"]`
- [x] 5. Delete `packages/core/src/dependencies.ts` and remove its exports from `index.ts`
- [x] 6. Remove flow methods from `QueueAdapter` interface: `getFlowTree`, `deleteFlow`, `incrementChildrenCompleted`, `getChildrenJobs`, `getFlows`
- [x] 7. Remove `addFlow`, `getFlowTree`, `createFlowNode` from `Queue` class
- [x] 8. Remove `promoteParentIfReady`, `failParentOnChildFailure`, and `filterByDependencies` from `Worker` class
- [x] 9. Remove old `FlowJobDefinition`, `FlowNode`, `FlowResult` types from `types.ts`
- [x] 10. Add `flowNodeId?: string` to `Job` interface
- [x] 11. Update `NewJob` type to reflect removed/added fields
- [x] 12. Fix all TypeScript compilation errors in core package after removals

## Phase 2: New Flow Types and Interfaces

- [x] 13. Create `packages/core/src/flow-types.ts` with: `FlowNodeStatus`, `FlowFailureStrategy`, `FlowNode`, `NewFlowNode`, `FlowTree`, `FlowSummary`, `FlowListOptions`, `FlowJobDefinition`, `FlowChainStep`, `FlowResult`, `FlowChainResult`, `FlowBulkThenResult`, `FlowProducerConfig`, `FlowProducerEvents`, `ChildrenFilter`, `ChildNodeValue`, `FlowJobContext`
- [x] 14. Create `FlowAdapter` interface in `packages/core/src/flow-types.ts`
- [x] 15. Update adapter props types (`PrismaAdapterProps`, `DrizzleAdapterProps`, etc.) with `flowTableName`/`flowModelName` fields
- [x] 16. Export new flow types from `packages/core/src/index.ts`

## Phase 3: FlowProducer Class

- [x] 17. Create `packages/core/src/flow-producer.ts` with `FlowProducer` class extending `TypedEventEmitter<FlowProducerEvents>`
- [x] 18. Implement `FlowProducer.add(definition)` — creates flow tree, leaf jobs in transaction
- [x] 19. Implement `FlowProducer.addChain(steps)` — transforms to nested parent-child tree
- [x] 20. Implement `FlowProducer.addBulkThen(parallel, final)` — transforms to parent with N children
- [x] 21. Implement `FlowProducer.getFlow(flowId)` — retrieves full tree
- [x] 22. Implement `FlowProducer.getFlows(options)` — list with pagination/status filter
- [x] 23. Implement flow cleanup logic (removeOnComplete configuration)
- [x] 24. Export `FlowProducer` from `packages/core/src/index.ts`

## Phase 4: Worker Integration

- [x] 25. Add flow-node promotion logic to Worker: after job completes, check `flowNodeId`, update node, check parent promotability
- [x] 26. Implement `fail-parent` cascade: when child with `fail-parent` strategy fails terminally, fail parent node recursively
- [x] 27. Implement `continue-parent` promotion: when child with `continue-parent` fails, promote parent immediately
- [x] 28. Implement default strategy: promote parent when all direct children are terminal
- [x] 29. Implement `FlowJobContext` methods in Worker's job context: `getChildrenValues`, `getFailedChildrenValues`, `getChildrenValuesBy`, `removeUnprocessedChildren`
- [x] 30. Emit flow events from Worker: `flow:completed`, `flow:failed`, `flow:node:promoted`

## Phase 5: Memory Adapter (reference implementation)

- [x] 31. Remove old flow methods from `MemoryQueueAdapter`: `getFlowTree`, `deleteFlow`, `incrementChildrenCompleted`, `getChildrenJobs`, `getFlows`
- [x] 32. Remove old flow fields from memory adapter's job storage/mapping
- [x] 33. Add `flowNodeId` support to memory adapter's `addJob`/`getNextJob`
- [x] 34. Implement `FlowAdapter` interface in `MemoryQueueAdapter` with in-memory `flow_nodes` Map
- [x] 35. Implement all `FlowAdapter` methods: `createFlow`, `getFlowNode`, `getFlowTree`, `getFlows`, `updateFlowNode`, `incrementNodeChildrenCompleted`, `getNodeChildren`, `getChildrenResults`, `getFailedChildrenResults`, `cancelUnprocessedChildren`, `deleteFlow`, `cleanupFlows`

## Phase 6: Drizzle Adapter

- [x] 36. Update `postgres-schema.ts`: remove old flow columns (`parent_id`, `flow_id`, `children_count`, `children_completed`, `fail_parent_on_failure`, `depends_on`, `on_dependency_failure`), add `flow_node_id`
- [x] 37. Create `flow-schema.ts` with `queueFlows` table definition
- [x] 38. Update adapter class: remove old flow methods, remove old field mappings in `transformJob`/`addJob`/`addJobs`
- [x] 39. Implement `FlowAdapter` interface in Drizzle adapter with transactional `createFlow`
- [x] 40. Update adapter config to accept `flowModelName` option
- [x] 41. Export new flow schema from package

## Phase 7: Prisma Adapter

- [x] 42. Update `schema.prisma`: remove old flow columns, add `flowNodeId`, add `QueueFlow` model with `@@map("queue_flows")`
- [x] 43. Regenerate Prisma client
- [x] 44. Update adapter class: remove old flow methods, remove old field mappings in `transformPrismaJob`/`addJob`
- [x] 45. Implement `FlowAdapter` interface in Prisma adapter with transactional `createFlow`
- [x] 46. Update adapter config to accept `flowModelName` and `flowTableName` options

## Phase 8: Kysely Adapter

- [x] 47. Update table type definition: remove old flow columns, add `flow_node_id`
- [x] 48. Create `queue_flows` table type definition
- [x] 49. Update adapter class: remove old flow methods, remove old field mappings in `transformJob`/`addJob`
- [x] 50. Implement `FlowAdapter` interface in Kysely adapter with transactional `createFlow`
- [x] 51. Update adapter config to accept `flowTableName` option

## Phase 9: ZenStack Adapter

- [x] 52. Update ZenStack schema: remove old flow columns, add `flowNodeId`, add `QueueFlow` model
- [x] 53. Update adapter class: remove old flow methods, implement `FlowAdapter`
- [x] 54. Update adapter config to accept `flowModelName` and `flowTableName` options

## Phase 10: TypeORM Adapter

- [x] 55. Update entity definition: remove old flow columns, add `flowNodeId`
- [x] 56. Create `QueueFlow` entity
- [x] 57. Update adapter class: remove old flow methods, implement `FlowAdapter`
- [x] 58. Update adapter config to accept `flowTableName` option

## Phase 11: MikroORM Adapter

- [x] 59. Update entity definition: remove old flow columns, add `flowNodeId`
- [x] 60. Create `QueueFlow` entity
- [x] 61. Update adapter class: remove old flow methods, implement `FlowAdapter`
- [x] 62. Update adapter config to accept `flowTableName` option

## Phase 12: Sequelize Adapter

- [x] 63. Update model definition: remove old flow columns, add `flowNodeId`
- [x] 64. Create `QueueFlow` model
- [x] 65. Update adapter class: remove old flow methods, implement `FlowAdapter`
- [x] 66. Update adapter config to accept `flowTableName` option

## Phase 13: Shared Tests

- [x] 67. Remove old flow field persistence tests from `shared-tests`
- [x] 68. Remove old `deleteFlow` / `incrementChildrenCompleted` / `getFlowTree` tests
- [x] 69. Add new `FlowAdapter` shared tests: `createFlow` atomicity, `getFlowTree`, `getFlows`, `updateFlowNode`, `incrementNodeChildrenCompleted`, `getNodeChildren`, `cancelUnprocessedChildren`, `deleteFlow`, `cleanupFlows`
- [x] 70. Add flow integration tests: full lifecycle (create → children complete → parent promoted → parent completes), failure strategies, nested flows, cross-queue flows

## Phase 14: Core Flow E2E Tests

- [x] 71. Rewrite `packages/core/tests/flow.test.ts`: FlowProducer.add with parent/children, FlowProducer.addChain, FlowProducer.addBulkThen
- [x] 72. Test failure strategies: default (promote on all terminal), fail-parent (cascade), continue-parent (immediate promote)
- [x] 73. Test FlowJobContext: getChildrenValues, getFailedChildrenValues, getChildrenValuesBy, removeUnprocessedChildren
- [x] 74. Test flow cleanup (removeOnComplete)
- [x] 75. Test flow events emission

## Phase 15: Final Cleanup

- [x] 76. Remove `packages/core/tests/dependency.test.ts` (if exists)
- [x] 77. Update changeset: replace `workflow-engine.md` with new flow-producer changeset
- [x] 78. Run `pnpm format:fix && pnpm lint:fix && pnpm typecheck` — fix all issues
- [x] 79. Run all adapter tests: `pnpm test:drizzle`, `pnpm test:prisma`, `pnpm test:kysely`, `pnpm test:zenstack`, `pnpm test:typeorm`, `pnpm test:mikroorm`, `pnpm test:sequelize`
- [x] 80. Run core tests: verify all pass
