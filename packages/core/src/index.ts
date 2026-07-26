// Main classes
export { Queue } from "./queue"
export { Worker } from "./worker"
export { FlowProducer } from "./flow-producer"

// Adapters
export { BaseQueueAdapter } from "./adapters/base"
export { MemoryQueueAdapter } from "./adapters/memory"

// State machine
export {
  validateTransition,
  isValidTransition,
  isTerminalStatus,
} from "./state-machine"

// Retry
export { calculateRetryDelay, DEFAULT_RETRY_STRATEGY } from "./retry"

// Events
export { TypedEventEmitter } from "./events"

// Errors
export {
  TimeoutError,
  DuplicateJobError,
  JobFailedError,
  JobCancelledError,
  JobDeadError,
  InvalidTransitionError,
} from "./errors"

// Utilities
export { serializeError } from "./utils/error"
export {
  asUtc,
  parseCron,
  calculateNextRun,
  toUtcDate,
} from "./utils/scheduler"

// Types
export type {
  Job,
  JobStatus,
  TerminalStatus,
  ActiveStatus,
  JobOptions,
  JobHandler,
  JobContext,
  JobWithProgress,
  BatchJobHandler,
  HandlerOptions,
  BatchHandlerOptions,
  QueueAdapter,
  QueueConfig,
  QueueEvents,
  QueueStats,
  WorkerConfig,
  WorkerEvents,
  NewJob,
  GetNextJobOptions,
  JobStatusUpdate,
  CancelJobsFilter,
  PaginationOptions,
  SerializedError,
  StepState,
  StepContext,
  StepRunOptions,
  WaitForOptions,
  TriggerConfig,
  RetryStrategyConfig,
  AdapterKind,
  AdapterProps,
  PrismaAdapterProps,
  KyselyAdapterProps,
  DrizzleAdapterProps,
  ZenstackAdapterProps,
  TypeormAdapterProps,
  MikroormAdapterProps,
  SequelizeAdapterProps,
} from "./types"

// Flow Types
export type {
  FlowNodeStatus,
  FlowFailureStrategy,
  FlowNode,
  NewFlowNode,
  FlowNodeUpdate,
  FlowTree,
  FlowSummary,
  FlowListOptions,
  FlowJobDefinition,
  FlowChainStep,
  FlowResult,
  FlowChainResult,
  FlowBulkThenResult,
  FlowProducerConfig,
  FlowProducerEvents,
  ChildrenFilter,
  ChildNodeValue,
  FlowJobContext,
  FlowAdapter,
} from "./flow-types"

// Query Builder (filter types)
export type {
  DateTimeFilter,
  IntFilter,
  JobStatusFilter,
  JobWhereInput,
  NormalizedJobWhereInput,
  NullFilter,
  StringFilter,
} from "@vorsteh-queue/query-builder"

export { normalizeWhere, matchesWhere } from "@vorsteh-queue/query-builder"

// Steps
export {
  createStepContext,
  calculateStepProgress,
  SleepInterrupt,
  WaitForInterrupt,
} from "./steps"

// Rate Limiting
export { RateLimiter, RateLimiterRegistry } from "./rate-limiter"

// Telemetry
export {
  noopTelemetry,
  createTelemetry,
  createOtelTelemetry,
} from "./telemetry"
export type { Telemetry, TelemetryConfig, TelemetrySpan } from "./telemetry"

// Constants
export { STATE_TRANSITIONS } from "./types"
