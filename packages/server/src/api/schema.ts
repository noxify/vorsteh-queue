/**
 * GraphQL schema definition using Pothos.
 */

import SchemaBuilder from "@pothos/core"
import type {
  FlowNode,
  Job,
  JobStatus,
  QueueAdapter,
  QueueStats,
  SerializedError,
} from "@vorsteh-queue/core"

import type { PubSub } from "./pubsub"

export interface SchemaContext {
  adapter: QueueAdapter
  queueName: string
  pubsub: PubSub
}

const builder = new SchemaBuilder<{ Context: SchemaContext }>({})

// ─── Enums ───────────────────────────────────────────────────────────────────

const JobStatusEnum = builder.enumType("JobStatus", {
  values: {
    pending: { value: "pending" },
    delayed: { value: "delayed" },
    processing: { value: "processing" },
    completed: { value: "completed" },
    failed: { value: "failed" },
    cancelled: { value: "cancelled" },
    dead: { value: "dead" },
    waiting_children: { value: "waiting-children" },
  },
})

// ─── Object Types ────────────────────────────────────────────────────────────

const SerializedErrorType = builder
  .objectRef<SerializedError>("SerializedError")
  .implement({
    fields: (t) => ({
      name: t.exposeString("name"),
      message: t.exposeString("message"),
      stack: t.string({
        nullable: true,
        resolve: (parent) => parent.stack ?? null,
      }),
    }),
  })

const QueueStatsType = builder.objectRef<QueueStats>("QueueStats").implement({
  fields: (t) => ({
    pending: t.exposeInt("pending"),
    delayed: t.exposeInt("delayed"),
    processing: t.exposeInt("processing"),
    completed: t.exposeInt("completed"),
    failed: t.exposeInt("failed"),
    cancelled: t.exposeInt("cancelled"),
    dead: t.exposeInt("dead"),
  }),
})

const JobType = builder.objectRef<Job>("Job").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    payload: t.field({
      type: "String",
      resolve: (parent) => JSON.stringify(parent.payload),
    }),
    status: t.field({
      type: JobStatusEnum,
      resolve: (parent) => parent.status,
    }),
    priority: t.exposeInt("priority"),
    attempts: t.exposeInt("attempts"),
    maxAttempts: t.exposeInt("maxAttempts"),
    progress: t.exposeInt("progress"),
    groupKey: t.string({
      nullable: true,
      resolve: (parent) => parent.groupKey ?? null,
    }),
    uniqueKey: t.string({
      nullable: true,
      resolve: (parent) => parent.uniqueKey ?? null,
    }),
    cron: t.string({
      nullable: true,
      resolve: (parent) => parent.cron ?? null,
    }),
    cancellationReason: t.string({
      nullable: true,
      resolve: (parent) => parent.cancellationReason ?? null,
    }),
    error: t.field({
      type: SerializedErrorType,
      nullable: true,
      resolve: (parent) => parent.error ?? null,
    }),
    result: t.string({
      nullable: true,
      resolve: (parent) =>
        parent.result ? JSON.stringify(parent.result) : null,
    }),
    createdAt: t.string({
      resolve: (parent) => parent.createdAt.toISOString(),
    }),
    processAt: t.string({
      resolve: (parent) => parent.processAt.toISOString(),
    }),
    processedAt: t.string({
      nullable: true,
      resolve: (parent) => parent.processedAt?.toISOString() ?? null,
    }),
    completedAt: t.string({
      nullable: true,
      resolve: (parent) => parent.completedAt?.toISOString() ?? null,
    }),
    failedAt: t.string({
      nullable: true,
      resolve: (parent) => parent.failedAt?.toISOString() ?? null,
    }),
    cancelledAt: t.string({
      nullable: true,
      resolve: (parent) => parent.cancelledAt?.toISOString() ?? null,
    }),
  }),
})

// ─── Queries ─────────────────────────────────────────────────────────────────

builder.queryType({
  fields: (t) => ({
    stats: t.field({
      type: QueueStatsType,
      resolve: async (_parent, _args, ctx) => ctx.adapter.getQueueStats(),
    }),

    job: t.field({
      type: JobType,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.getJobById(String(args.id)),
    }),

    jobs: t.field({
      type: [JobType],
      args: {
        status: t.arg({ type: JobStatusEnum, required: false }),
        name: t.arg.string({ required: false }),
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.getJobs({
          status: args.status as JobStatus | undefined,
          name: args.name ?? undefined,
          limit: args.limit ?? 20,
          offset: args.offset ?? 0,
        }),
    }),

    deadJobs: t.field({
      type: [JobType],
      args: {
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.getDeadJobs({
          limit: args.limit ?? 50,
          offset: args.offset ?? 0,
        }),
    }),

    size: t.int({
      resolve: async (_parent, _args, ctx) => ctx.adapter.size(),
    }),

    flowTree: t.field({
      type: FlowNodeType,
      nullable: true,
      args: { flowId: t.arg.string({ required: true }) },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.getFlowTree(args.flowId),
    }),

    flows: t.field({
      type: [FlowEntryType],
      args: {
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.getFlows({
          limit: args.limit ?? 20,
          offset: args.offset ?? 0,
        }),
    }),
  }),
})

// ─── Mutations ───────────────────────────────────────────────────────────────

builder.mutationType({
  fields: (t) => ({
    cancelJob: t.field({
      type: "Boolean",
      args: {
        id: t.arg.id({ required: true }),
        reason: t.arg.string({ required: false }),
      },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.cancelJob(String(args.id), args.reason ?? undefined),
    }),

    redriveJob: t.field({
      type: "Boolean",
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_parent, args, ctx) => {
        await ctx.adapter.redriveJob(String(args.id))
        return true
      },
    }),

    redriveAll: t.int({
      args: { name: t.arg.string({ required: false }) },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.redriveJobs(args.name ? { name: args.name } : undefined),
    }),

    clearJobs: t.int({
      args: { status: t.arg({ type: JobStatusEnum, required: false }) },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.clearJobs(args.status as JobStatus | undefined),
    }),

    retryJob: t.field({
      type: "Boolean",
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.retryJob(String(args.id)),
    }),

    runJobNow: t.field({
      type: "Boolean",
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.runJobNow(String(args.id)),
    }),

    deleteJob: t.field({
      type: "Boolean",
      args: { id: t.arg.id({ required: true }) },
      resolve: async (_parent, args, ctx) =>
        ctx.adapter.deleteJob(String(args.id)),
    }),
  }),
})

// ─── Flow Types ──────────────────────────────────────────────────────────────

const FlowNodeType = builder.objectRef<FlowNode>("FlowNode")

FlowNodeType.implement({
  fields: (t) => ({
    job: t.field({ type: JobType, resolve: (parent) => parent.job }),
    children: t.field({
      type: [FlowNodeType],
      resolve: (parent) => parent.children,
    }),
  }),
})

const FlowEntryType = builder
  .objectRef<{ flowId: string; rootJob: Job }>("FlowEntry")
  .implement({
    fields: (t) => ({
      flowId: t.exposeString("flowId"),
      rootJob: t.field({ type: JobType, resolve: (parent) => parent.rootJob }),
    }),
  })

// ─── Subscriptions ───────────────────────────────────────────────────────────

builder.subscriptionType({
  fields: (t) => ({
    jobStatusChanged: t.field({
      type: JobType,
      subscribe: (_parent, _args, ctx) =>
        ctx.pubsub.subscribe("job:statusChanged"),
      resolve: (payload: Job) => payload,
    }),

    statsUpdated: t.field({
      type: QueueStatsType,
      subscribe: (_parent, _args, ctx) => ctx.pubsub.subscribe("stats:updated"),
      resolve: (payload: QueueStats) => payload,
    }),
  }),
})

export const schema = builder.toSchema()
