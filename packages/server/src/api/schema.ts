/**
 * GraphQL schema definition using Pothos.
 */

import SchemaBuilder from "@pothos/core"
import type {
  FlowNode,
  Job,
  JobStatus,
  Queue,
  QueueStats,
  SerializedError,
} from "@vorsteh-queue/core"
import { createGraphQLError } from "graphql-yoga"

import type { PubSub } from "./pubsub"

export interface SchemaContext {
  queues: readonly Queue[]
  pubsub: PubSub
}

/**
 * Look up a Queue instance by name from the configured queues list.
 *
 * @param name - The queue name to find
 * @param queues - The list of configured Queue instances
 * @returns The matching Queue instance
 * @throws {GraphQLError} If the queue name is not found
 */
function getQueue(name: string, queues: readonly Queue[]): Queue {
  const queue = queues.find((q) => q.name === name)
  if (!queue) {
    throw createGraphQLError(
      `Queue '${name}' not found. Available queues: ${queues.map((q) => q.name).join(", ")}`,
      { extensions: { code: "BAD_USER_INPUT" } }
    )
  }
  return queue
}

const builder = new SchemaBuilder<{ Context: SchemaContext }>({})

// ─── Enums ───────────────────────────────────────────────────────────────────

const JobStatusEnum = builder.enumType("JobStatus", {
  values: {
    cancelled: { value: "cancelled" },
    completed: { value: "completed" },
    dead: { value: "dead" },
    delayed: { value: "delayed" },
    failed: { value: "failed" },
    pending: { value: "pending" },
    processing: { value: "processing" },
    waiting_children: { value: "waiting-children" },
  },
})

// ─── Object Types ────────────────────────────────────────────────────────────

const SerializedErrorType = builder
  .objectRef<SerializedError>("SerializedError")
  .implement({
    fields: (t) => ({
      message: t.exposeString("message"),
      name: t.exposeString("name"),
      stack: t.string({
        nullable: true,
        resolve: (parent) => parent.stack ?? null,
      }),
    }),
  })

const QueueStatsType = builder.objectRef<QueueStats>("QueueStats").implement({
  fields: (t) => ({
    cancelled: t.exposeInt("cancelled"),
    completed: t.exposeInt("completed"),
    dead: t.exposeInt("dead"),
    delayed: t.exposeInt("delayed"),
    failed: t.exposeInt("failed"),
    pending: t.exposeInt("pending"),
    processing: t.exposeInt("processing"),
  }),
})

const JobType = builder.objectRef<Job>("Job").implement({
  fields: (t) => ({
    attempts: t.exposeInt("attempts"),
    cancellationReason: t.string({
      nullable: true,
      resolve: (parent) => parent.cancellationReason ?? null,
    }),
    cancelledAt: t.string({
      nullable: true,
      resolve: (parent) => parent.cancelledAt?.toISOString() ?? null,
    }),
    completedAt: t.string({
      nullable: true,
      resolve: (parent) => parent.completedAt?.toISOString() ?? null,
    }),
    createdAt: t.string({
      resolve: (parent) => parent.createdAt.toISOString(),
    }),
    cron: t.string({
      nullable: true,
      resolve: (parent) => parent.cron ?? null,
    }),
    error: t.field({
      type: SerializedErrorType,
      nullable: true,
      resolve: (parent) => parent.error ?? null,
    }),
    failedAt: t.string({
      nullable: true,
      resolve: (parent) => parent.failedAt?.toISOString() ?? null,
    }),
    groupKey: t.string({
      nullable: true,
      resolve: (parent) => parent.groupKey ?? null,
    }),
    id: t.exposeID("id"),
    maxAttempts: t.exposeInt("maxAttempts"),
    name: t.exposeString("name"),
    payload: t.field({
      type: "String",
      resolve: (parent) => JSON.stringify(parent.payload),
    }),
    priority: t.exposeInt("priority"),
    processAt: t.string({
      resolve: (parent) => parent.processAt.toISOString(),
    }),
    processedAt: t.string({
      nullable: true,
      resolve: (parent) => parent.processedAt?.toISOString() ?? null,
    }),
    progress: t.exposeInt("progress"),
    result: t.string({
      nullable: true,
      resolve: (parent) =>
        parent.result ? JSON.stringify(parent.result) : null,
    }),
    status: t.field({
      type: JobStatusEnum,
      resolve: (parent) => parent.status,
    }),
    uniqueKey: t.string({
      nullable: true,
      resolve: (parent) => parent.uniqueKey ?? null,
    }),
  }),
})

const QueueInfoType = builder
  .objectRef<{ name: string; isDefault: boolean }>("QueueInfo")
  .implement({
    fields: (t) => ({
      isDefault: t.exposeBoolean("isDefault"),
      name: t.exposeString("name"),
    }),
  })

// ─── Queries ─────────────────────────────────────────────────────────────────

builder.queryType({
  fields: (t) => ({
    deadJobs: t.field({
      type: [JobType],
      args: {
        queue: t.arg.string({ required: true }),
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.getDeadJobs({
          limit: args.limit ?? 50,
          offset: args.offset ?? 0,
        })
      },
    }),

    flowTree: t.field({
      type: FlowNodeType,
      nullable: true,
      args: {
        queue: t.arg.string({ required: true }),
        flowId: t.arg.string({ required: true }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.getFlowTree(args.flowId)
      },
    }),

    flows: t.field({
      type: [FlowEntryType],
      args: {
        queue: t.arg.string({ required: true }),
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.getFlows({
          limit: args.limit ?? 20,
          offset: args.offset ?? 0,
        })
      },
    }),

    job: t.field({
      type: JobType,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
        queue: t.arg.string({ required: false }),
      },
      resolve: async (_parent, args, ctx) => {
        if (args.queue) {
          const queue = getQueue(args.queue, ctx.queues)
          return queue.adapter.getJobById(String(args.id))
        }
        // Search all queues
        for (const queue of ctx.queues) {
          const job = await queue.adapter.getJobById(String(args.id))
          if (job) {
            return job
          }
        }
        return null
      },
    }),

    jobs: t.field({
      type: [JobType],
      args: {
        queue: t.arg.string({ required: true }),
        status: t.arg({ type: JobStatusEnum, required: false }),
        name: t.arg.string({ required: false }),
        limit: t.arg.int({ required: false }),
        offset: t.arg.int({ required: false }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.getJobs({
          status: args.status as JobStatus | undefined,
          name: args.name ?? undefined,
          limit: args.limit ?? 20,
          offset: args.offset ?? 0,
        })
      },
    }),

    queues: t.field({
      type: [QueueInfoType],
      resolve: (_parent, _args, ctx) =>
        ctx.queues.map((q) => ({
          name: q.name,
          isDefault: false,
        })),
    }),

    size: t.int({
      args: { queue: t.arg.string({ required: true }) },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.size()
      },
    }),

    stats: t.field({
      type: QueueStatsType,
      args: { queue: t.arg.string({ required: true }) },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.getQueueStats()
      },
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
        queue: t.arg.string({ required: true }),
        reason: t.arg.string({ required: false }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.cancelJob(
          String(args.id),
          args.reason ?? undefined
        )
      },
    }),

    clearJobs: t.int({
      args: {
        queue: t.arg.string({ required: true }),
        status: t.arg({ type: JobStatusEnum, required: false }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.clearJobs(args.status as JobStatus | undefined)
      },
    }),

    deleteJob: t.field({
      type: "Boolean",
      args: {
        id: t.arg.id({ required: true }),
        queue: t.arg.string({ required: true }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.deleteJob(String(args.id))
      },
    }),

    redriveAll: t.int({
      args: {
        queue: t.arg.string({ required: true }),
        name: t.arg.string({ required: false }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.redriveJobs(
          args.name ? { name: args.name } : undefined
        )
      },
    }),

    redriveJob: t.field({
      type: "Boolean",
      args: {
        id: t.arg.id({ required: true }),
        queue: t.arg.string({ required: true }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        await queue.adapter.redriveJob(String(args.id))
        return true
      },
    }),

    retryJob: t.field({
      type: "Boolean",
      args: {
        id: t.arg.id({ required: true }),
        queue: t.arg.string({ required: true }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.retryJob(String(args.id))
      },
    }),

    runJobNow: t.field({
      type: "Boolean",
      args: {
        id: t.arg.id({ required: true }),
        queue: t.arg.string({ required: true }),
      },
      resolve: async (_parent, args, ctx) => {
        const queue = getQueue(args.queue, ctx.queues)
        return queue.adapter.runJobNow(String(args.id))
      },
    }),
  }),
})

// ─── Flow Types ──────────────────────────────────────────────────────────────

const FlowNodeType = builder.objectRef<FlowNode>("FlowNode")

FlowNodeType.implement({
  fields: (t) => ({
    children: t.field({
      type: [FlowNodeType],
      resolve: (parent) => parent.children,
    }),
    job: t.field({ type: JobType, resolve: (parent) => parent.job }),
  }),
})

const FlowEntryType = builder
  .objectRef<{ flowId: string; rootJob: Job }>("FlowEntry")
  .implement({
    fields: (t) => ({
      flowId: t.exposeString("flowId"),
      rootJob: t.field({ resolve: (parent) => parent.rootJob, type: JobType }),
    }),
  })

// ─── Subscriptions ───────────────────────────────────────────────────────────

builder.subscriptionType({
  fields: (t) => ({
    jobStatusChanged: t.field({
      resolve: (payload: Job) => payload,
      subscribe: (_parent, _args, ctx) =>
        ctx.pubsub.subscribe("job:statusChanged"),
      type: JobType,
    }),

    statsUpdated: t.field({
      resolve: (payload: QueueStats) => payload,
      subscribe: (_parent, _args, ctx) => ctx.pubsub.subscribe("stats:updated"),
      type: QueueStatsType,
    }),
  }),
})

export const schema = builder.toSchema()
