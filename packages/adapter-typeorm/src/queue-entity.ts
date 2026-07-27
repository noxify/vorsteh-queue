import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm"

/**
 * TypeORM entity for queue jobs.
 *
 * This entity maps to the `queue_jobs` table and can be used directly
 * with TypeORM's DataSource to manage the queue schema.
 *
 * @example
 * ```typescript
 * import { DataSource } from "typeorm"
 * import { QueueJobEntity } from "@vorsteh-queue/adapter-typeorm/entity"
 *
 * const dataSource = new DataSource({
 *   type: "postgres",
 *   entities: [QueueJobEntity],
 *   synchronize: true,
 * })
 * ```
 */
@Entity("queue_jobs")
@Index("idx_queue_jobs_polling", [
  "queueName",
  "status",
  "priority",
  "createdAt",
])
@Index("idx_queue_jobs_delayed", ["queueName", "processAt"])
@Index("idx_queue_jobs_active_groups", ["queueName", "groupKey"])
@Index("idx_queue_jobs_stats", ["queueName", "status"])
export class QueueJobEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string

  @Column({ name: "queue_name", type: "varchar", length: 255 })
  queueName!: string

  @Column({ type: "varchar", length: 255 })
  name!: string

  @Column({ type: "jsonb" })
  payload!: unknown

  @Column({ type: "varchar", length: 50 })
  status!: string

  @Column({ type: "int" })
  priority!: number

  @Column({ type: "int", default: 0 })
  attempts!: number

  @Column({ name: "max_attempts", type: "int" })
  maxAttempts!: number

  @Column({ type: "int", nullable: true })
  timeout!: number | null

  @Column({ type: "int", default: 0 })
  progress!: number

  @Column({ name: "group_key", type: "varchar", length: 255, nullable: true })
  groupKey!: string | null

  @Column({ name: "unique_key", type: "varchar", length: 255, nullable: true })
  uniqueKey!: string | null

  @Column({ type: "varchar", length: 255, nullable: true })
  cron!: string | null

  @Column({ name: "repeat_every", type: "int", nullable: true })
  repeatEvery!: number | null

  @Column({ name: "repeat_limit", type: "int", nullable: true })
  repeatLimit!: number | null

  @Column({ name: "repeat_count", type: "int", default: 0 })
  repeatCount!: number

  @Column({ name: "cancellation_reason", type: "text", nullable: true })
  cancellationReason!: string | null

  @Column({ type: "jsonb", nullable: true })
  error!: unknown

  @Column({ type: "jsonb", nullable: true })
  result!: unknown

  @Column({ type: "jsonb", nullable: true })
  steps!: unknown

  @Column({ type: "jsonb", nullable: true })
  signals!: unknown

  @Column({ name: "flow_node_id", type: "uuid", nullable: true })
  flowNodeId!: string | null

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    precision: 6,
    default: () => "timezone('utc', now())",
  })
  createdAt!: Date

  @Column({ name: "process_at", type: "timestamptz", precision: 6 })
  processAt!: Date

  @Column({
    name: "processed_at",
    type: "timestamptz",
    precision: 6,
    nullable: true,
  })
  processedAt!: Date | null

  @Column({
    name: "completed_at",
    type: "timestamptz",
    precision: 6,
    nullable: true,
  })
  completedAt!: Date | null

  @Column({
    name: "failed_at",
    type: "timestamptz",
    precision: 6,
    nullable: true,
  })
  failedAt!: Date | null

  @Column({
    name: "cancelled_at",
    type: "timestamptz",
    precision: 6,
    nullable: true,
  })
  cancelledAt!: Date | null
}
