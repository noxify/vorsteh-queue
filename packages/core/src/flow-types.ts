/**
 * Flow orchestration type definitions for vorsteh-queue 1.0.
 *
 * This module contains all types specific to the FlowProducer system,
 * including flow nodes, adapters, events, and job context extensions.
 */

import type { Telemetry } from "./telemetry"
import type { JobOptions, NewJob, SerializedError } from "./types"

// ─── Flow Node Status & Strategies ──────────────────────────────────────────

/** Status of a flow node in the orchestration lifecycle */
export type FlowNodeStatus =
  | "waiting"
  | "ready"
  | "completed"
  | "failed"
  | "cancelled"

/** Failure strategy for a child node — determines parent behavior on child failure */
export type FlowFailureStrategy = "default" | "fail-parent" | "continue-parent"

// ─── Flow Node (Database Record) ────────────────────────────────────────────

/** A flow node record as stored in the database (`queue_flows` table) */
export interface FlowNode {
  /** Unique node identifier (UUID) */
  readonly id: string
  /** Flow identifier — groups all nodes in a flow */
  readonly flowId: string
  /** Parent node ID (null for root nodes) */
  readonly parentNodeId?: string
  /** Job ID — set when node is promoted to ready */
  readonly jobId?: string
  /** Target queue for this node's job */
  readonly queueName: string
  /** Handler name */
  readonly name: string
  /** Job payload (stored until job creation) */
  readonly payload: unknown
  /** Job options (priority, timeout, etc.) */
  readonly options?: JobOptions
  /** Current node status */
  readonly status: FlowNodeStatus
  /** Failure strategy for this node */
  readonly failureStrategy: FlowFailureStrategy
  /** Number of direct children */
  readonly childrenCount: number
  /** Direct children that reached terminal state */
  readonly childrenCompleted: number
  /** Job result after completion */
  readonly result?: unknown
  /** Error info when failed */
  readonly error?: SerializedError
  /** When the node was created */
  readonly createdAt: Date
  /** When the node reached terminal state */
  readonly completedAt?: Date
}

// ─── New Flow Node (Input) ───────────────────────────────────────────────────

/** Input for creating a flow node (no timestamps/result/error).
 * Includes `id` so the producer can pre-generate UUIDs that match
 * the `parentNodeId` references and `flowNodeId` on leaf jobs.
 */
export type NewFlowNode = Omit<
  FlowNode,
  "createdAt" | "completedAt" | "result" | "error"
>

// ─── Flow Tree ───────────────────────────────────────────────────────────────

/** Tree representation returned by getFlowTree */
export interface FlowTree {
  /** The node at this level */
  readonly node: FlowNode
  /** Child subtrees */
  readonly children: readonly FlowTree[]
}

// ─── Flow Summary ────────────────────────────────────────────────────────────

/** Summary for flow listing */
export interface FlowSummary {
  /** Flow identifier */
  readonly flowId: string
  /** Root node of the flow */
  readonly rootNode: FlowNode
  /** Overall flow status (derived from root node) */
  readonly status: FlowNodeStatus
  /** When the flow was created */
  readonly createdAt: Date
  /** When the flow completed (if terminal) */
  readonly completedAt?: Date
}

// ─── Flow List Options ───────────────────────────────────────────────────────

/** Options for listing flows with pagination and filtering */
export interface FlowListOptions {
  /** Filter by flow status */
  readonly status?: FlowNodeStatus
  /** Maximum number of flows to return */
  readonly limit?: number
  /** Number of flows to skip */
  readonly offset?: number
}

// ─── FlowProducer Input Types ────────────────────────────────────────────────

/**
 * Input for flowProducer.add() — defines a node in the flow tree.
 *
 * All nodes in a single flow must target queues within the same database schema.
 * The `queueName` field determines which queue processes the job, but all flow
 * orchestration data (the `queue_flows` table) is stored in a single schema
 * alongside `queue_jobs`. Cross-database flows are not supported.
 */
export interface FlowJobDefinition {
  /** Handler name */
  readonly name: string
  /** Target queue for this node's job.
   *
   * While nodes in a flow may target different queues, all queues must share
   * the same database schema to enable atomic flow transactions.
   */
  readonly queueName: string
  /** Job payload data */
  readonly payload: unknown
  /** Job options (priority, timeout, etc.) */
  readonly options?: JobOptions
  /** Failure strategy for this node
   * @default "default"
   */
  readonly failureStrategy?: FlowFailureStrategy
  /** Child node definitions */
  readonly children?: readonly FlowJobDefinition[]
}

/** Input for flowProducer.addChain() — a sequential step */
export interface FlowChainStep {
  /** Handler name */
  readonly name: string
  /** Target queue for this node's job */
  readonly queueName: string
  /** Job payload data */
  readonly payload: unknown
  /** Job options (priority, timeout, etc.) */
  readonly options?: JobOptions
}

// ─── Flow Results ────────────────────────────────────────────────────────────

/** Result of flow creation via flowProducer.add() */
export interface FlowResult {
  /** Flow identifier */
  readonly flowId: string
  /** Root node of the created flow */
  readonly rootNode: FlowNode
}

/** Result of flowProducer.addChain() */
export interface FlowChainResult {
  /** Flow identifier */
  readonly flowId: string
  /** All nodes in the chain (ordered from first to last) */
  readonly nodes: readonly FlowNode[]
}

/** Result of flowProducer.addBulkThen() */
export interface FlowBulkThenResult {
  /** Flow identifier */
  readonly flowId: string
  /** Parallel nodes (children of the final node) */
  readonly parallelNodes: readonly FlowNode[]
  /** Final node that runs after all parallel nodes complete */
  readonly finalNode: FlowNode
}

// ─── FlowProducer Configuration ─────────────────────────────────────────────

/** Configuration options for the FlowProducer */
export interface FlowProducerConfig {
  /** Remove completed flows: true = immediate, number = keep N
   * @default 100
   */
  readonly removeOnComplete?: boolean | number
  /** Optional telemetry instance for flow-level observability */
  readonly telemetry?: Telemetry
}

// ─── FlowProducer Events ─────────────────────────────────────────────────────

/** Events emitted by the FlowProducer for observability */
export interface FlowProducerEvents {
  /** Emitted when a new flow is created */
  "flow:created": FlowResult
  /** Emitted when the root node's job completes successfully */
  "flow:completed": { flowId: string; result: unknown }
  /** Emitted when the root node is marked as failed */
  "flow:failed": { flowId: string; error: SerializedError }
  /** Emitted when a parent node transitions from waiting to ready */
  "flow:node:promoted": { flowId: string; nodeId: string; jobId: string }
}

// ─── Children Filter & Context ───────────────────────────────────────────────

/** Filter criteria for querying children of a flow node */
export interface ChildrenFilter {
  /** Filter by child node name(s) */
  readonly name?: string | readonly string[]
  /** Filter by child node status(es) */
  readonly status?: FlowNodeStatus | readonly FlowNodeStatus[]
}

/** Value returned per child node from getChildrenValuesBy */
export interface ChildNodeValue {
  /** Child node identifier */
  readonly nodeId: string
  /** Child node handler name */
  readonly name: string
  /** Terminal status of the child node */
  readonly status: "completed" | "failed" | "cancelled"
  /** Job result (only set when completed) */
  readonly result?: unknown
  /** Error info (only set when failed) */
  readonly error?: SerializedError
}

// ─── Flow Job Context ────────────────────────────────────────────────────────

/** Context extensions for flow-aware job handlers */
export interface FlowJobContext {
  /** Results of completed children (shortcut for getChildrenValuesBy({ status: "completed" })) */
  readonly getChildrenValues: () => Promise<ReadonlyMap<string, unknown>>
  /** Errors from failed children (shortcut for getChildrenValuesBy({ status: "failed" })) */
  readonly getFailedChildrenValues: () => Promise<
    ReadonlyMap<string, SerializedError>
  >
  /** Flexible query for children by filter criteria */
  readonly getChildrenValuesBy: (
    filter: ChildrenFilter
  ) => Promise<ReadonlyMap<string, ChildNodeValue>>
  /** Cancel all unprocessed children and their subtrees */
  readonly removeUnprocessedChildren: () => Promise<number>
}

// ─── Flow Node Update ────────────────────────────────────────────────────────

/** Update payload for a flow node */
export interface FlowNodeUpdate {
  readonly status?: FlowNodeStatus
  readonly jobId?: string
  readonly result?: unknown
  readonly error?: SerializedError
  readonly completedAt?: Date
}

// ─── Flow Adapter ────────────────────────────────────────────────────────────

/** Persistence interface for flow orchestration data.
 *
 * All flow operations assume that `queue_flows` and `queue_jobs` tables reside
 * in the same database schema and share the same connection pool. This enables
 * atomic cross-table transactions required by flow creation.
 */
export interface FlowAdapter {
  /**
   * Create all flow nodes (and leaf jobs) in a single transaction.
   *
   * All nodes must target queues within the same database schema to guarantee
   * transactional integrity. Cross-database flows are not supported.
   */
  readonly createFlow: (
    nodes: readonly NewFlowNode[],
    leafJobs: readonly NewJob[]
  ) => Promise<readonly FlowNode[]>

  /** Get a flow node by ID. */
  readonly getFlowNode: (nodeId: string) => Promise<FlowNode | null>

  /** Get the full flow tree by flow ID. */
  readonly getFlowTree: (flowId: string) => Promise<FlowTree | null>

  /** List flows with pagination and optional status filter. */
  readonly getFlows: (
    options?: FlowListOptions
  ) => Promise<readonly FlowSummary[]>

  /** Update a flow node's status and optional metadata. */
  readonly updateFlowNode: (
    nodeId: string,
    update: FlowNodeUpdate
  ) => Promise<void>

  /** Increment children_completed on a parent node. Returns updated counts. */
  readonly incrementNodeChildrenCompleted: (
    nodeId: string
  ) => Promise<{ completed: number; total: number }>

  /** Get direct children of a node. */
  readonly getNodeChildren: (nodeId: string) => Promise<readonly FlowNode[]>

  /** Get results of all completed child nodes. */
  readonly getChildrenResults: (
    nodeId: string
  ) => Promise<ReadonlyMap<string, unknown>>

  /** Get errors of all failed child nodes. */
  readonly getFailedChildrenResults: (
    nodeId: string
  ) => Promise<ReadonlyMap<string, unknown>>

  /** Cancel all unprocessed children (pending/delayed jobs) and their subtrees. */
  readonly cancelUnprocessedChildren: (nodeId: string) => Promise<number>

  /** Delete all nodes in a flow. */
  readonly deleteFlow: (flowId: string) => Promise<number>

  /** Cleanup completed flows, keeping only N most recent. */
  readonly cleanupFlows: (keepCount: number) => Promise<number>
}
