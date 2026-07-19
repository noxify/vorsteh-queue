import { EntitySchema } from "@mikro-orm/core"

/**
 * MikroORM entity schema for queue jobs.
 *
 * Defines the `queue_jobs` table structure using MikroORM's EntitySchema
 * pattern (no decorators required).
 *
 * @example
 * ```typescript
 * import { MikroORM } from "@mikro-orm/postgresql"
 * import { QueueJobEntity } from "@vorsteh-queue/adapter-mikroorm/entity"
 *
 * const orm = await MikroORM.init({
 *   entities: [QueueJobEntity],
 *   clientUrl: "postgresql://user:pass@localhost/db",
 * })
 * ```
 */
export class QueueJobEntity {
  id?: string
  queueName!: string
  name!: string
  payload!: unknown
  status!: string
  priority!: number
  attempts!: number
  maxAttempts!: number
  timeout!: number | null
  progress!: number
  groupKey!: string | null
  uniqueKey!: string | null
  cron!: string | null
  repeatEvery!: number | null
  repeatLimit!: number | null
  repeatCount!: number
  cancellationReason!: string | null
  dependsOn!: unknown
  onDependencyFailure!: string | null
  error!: unknown
  result!: unknown
  steps!: unknown
  signals!: unknown
  parentId!: string | null
  flowId!: string | null
  childrenCount!: number
  childrenCompleted!: number
  failParentOnFailure!: number
  createdAt?: Date
  processAt!: Date
  processedAt!: Date | null
  completedAt!: Date | null
  failedAt!: Date | null
  cancelledAt!: Date | null
}

export const QueueJobSchema = new EntitySchema<QueueJobEntity>({
  class: QueueJobEntity,
  tableName: "queue_jobs",
  properties: {
    id: {
      type: "uuid",
      primary: true,
      fieldName: "id",
      defaultRaw: "gen_random_uuid()",
    },
    queueName: { type: "string", fieldName: "queue_name" },
    name: { type: "string" },
    payload: { type: "json", columnType: "jsonb" },
    status: { type: "string" },
    priority: { type: "integer" },
    attempts: { type: "integer", default: 0 },
    maxAttempts: { type: "integer", fieldName: "max_attempts" },
    timeout: { type: "integer", nullable: true },
    progress: { type: "integer", default: 0 },
    groupKey: { type: "string", nullable: true, fieldName: "group_key" },
    uniqueKey: { type: "string", nullable: true, fieldName: "unique_key" },
    cron: { type: "string", nullable: true },
    repeatEvery: { type: "integer", nullable: true, fieldName: "repeat_every" },
    repeatLimit: { type: "integer", nullable: true, fieldName: "repeat_limit" },
    repeatCount: { type: "integer", default: 0, fieldName: "repeat_count" },
    cancellationReason: {
      type: "string",
      nullable: true,
      fieldName: "cancellation_reason",
    },
    dependsOn: {
      type: "json",
      columnType: "jsonb",
      nullable: true,
      fieldName: "depends_on",
    },
    onDependencyFailure: {
      type: "string",
      nullable: true,
      fieldName: "on_dependency_failure",
    },
    error: { type: "json", columnType: "jsonb", nullable: true },
    result: { type: "json", columnType: "jsonb", nullable: true },
    steps: { type: "json", columnType: "jsonb", nullable: true },
    signals: { type: "json", columnType: "jsonb", nullable: true },
    parentId: { type: "string", nullable: true, fieldName: "parent_id" },
    flowId: { type: "string", nullable: true, fieldName: "flow_id" },
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
    failParentOnFailure: {
      type: "integer",
      default: 0,
      fieldName: "fail_parent_on_failure",
    },
    createdAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      fieldName: "created_at",
      defaultRaw: "timezone('utc', now())",
    },
    processAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      fieldName: "process_at",
    },
    processedAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      nullable: true,
      fieldName: "processed_at",
    },
    completedAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      nullable: true,
      fieldName: "completed_at",
    },
    failedAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      nullable: true,
      fieldName: "failed_at",
    },
    cancelledAt: {
      type: "Date",
      columnType: "timestamptz(6)",
      nullable: true,
      fieldName: "cancelled_at",
    },
  },
})
