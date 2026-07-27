import { EntitySchema } from "@mikro-orm/core"

/**
 * MikroORM entity schema for flow nodes.
 *
 * Defines the `queue_flows` table structure using MikroORM's EntitySchema
 * pattern. This entity stores flow orchestration data separate from queue jobs.
 *
 * @example
 * ```typescript
 * import { MikroORM } from "@mikro-orm/postgresql"
 * import { QueueFlowSchema } from "@vorsteh-queue/adapter-mikroorm"
 *
 * const orm = await MikroORM.init({
 *   entities: [QueueFlowSchema],
 *   clientUrl: "postgresql://user:pass@localhost/db",
 * })
 * ```
 */
export class QueueFlowEntity {
  id!: string
  flowId!: string
  parentNodeId!: string | null
  jobId!: string | null
  queueName!: string
  name!: string
  payload!: unknown
  options!: unknown
  status!: string
  failureStrategy!: string
  childrenCount!: number
  childrenCompleted!: number
  result!: unknown
  error!: unknown
  createdAt?: Date
  completedAt!: Date | null
}

export const QueueFlowSchema = new EntitySchema<QueueFlowEntity>({
  class: QueueFlowEntity,
  tableName: "queue_flows",
  indexes: [
    { properties: ["flowId"], name: "idx_queue_flows_flow_id" },
    { properties: ["parentNodeId"], name: "idx_queue_flows_parent_node_id" },
    { properties: ["jobId"], name: "idx_queue_flows_job_id" },
    { properties: ["flowId", "status"], name: "idx_queue_flows_status" },
  ],
  properties: {
    id: {
      type: "uuid",
      primary: true,
      fieldName: "id",
    },
    flowId: { type: "uuid", fieldName: "flow_id" },
    parentNodeId: { type: "uuid", nullable: true, fieldName: "parent_node_id" },
    jobId: { type: "uuid", nullable: true, fieldName: "job_id" },
    queueName: { type: "string", fieldName: "queue_name" },
    name: { type: "string" },
    payload: { type: "json", columnType: "jsonb" },
    options: { type: "json", columnType: "jsonb", nullable: true },
    status: { type: "string" },
    failureStrategy: {
      type: "string",
      fieldName: "failure_strategy",
      default: "default",
    },
    childrenCount: {
      type: "integer",
      default: 0,
      fieldName: "children_count",
    },
    childrenCompleted: {
      type: "integer",
      default: 0,
      fieldName: "children_completed",
    },
    result: { type: "json", columnType: "jsonb", nullable: true },
    error: { type: "json", columnType: "jsonb", nullable: true },
    createdAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      fieldName: "created_at",
      defaultRaw: "timezone('utc', now())",
    },
    completedAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      nullable: true,
      fieldName: "completed_at",
    },
  },
})
