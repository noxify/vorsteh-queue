import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from "typeorm"

/**
 * TypeORM entity for flow nodes.
 *
 * This entity maps to the `queue_flows` table and stores flow orchestration
 * data separate from queue jobs.
 *
 * @example
 * ```typescript
 * import { DataSource } from "typeorm"
 * import { QueueFlowEntity } from "@vorsteh-queue/adapter-typeorm/entity"
 *
 * const dataSource = new DataSource({
 *   type: "postgres",
 *   entities: [QueueFlowEntity],
 *   synchronize: true,
 * })
 * ```
 */
@Entity("queue_flows")
@Index("idx_queue_flows_flow_id", ["flowId"])
@Index("idx_queue_flows_parent_node_id", ["parentNodeId"])
@Index("idx_queue_flows_job_id", ["jobId"])
@Index("idx_queue_flows_status", ["flowId", "status"])
export class QueueFlowEntity {
  @PrimaryColumn({ type: "uuid" })
  id!: string

  @Column({ name: "flow_id", type: "uuid" })
  flowId!: string

  @Column({ name: "parent_node_id", type: "uuid", nullable: true })
  parentNodeId!: string | null

  @Column({ name: "job_id", type: "uuid", nullable: true })
  jobId!: string | null

  @Column({ name: "queue_name", type: "varchar", length: 255 })
  queueName!: string

  @Column({ type: "varchar", length: 255 })
  name!: string

  @Column({ type: "jsonb" })
  payload!: unknown

  @Column({ type: "jsonb", nullable: true })
  options!: unknown

  @Column({ type: "varchar", length: 50 })
  status!: string

  @Column({
    name: "failure_strategy",
    type: "varchar",
    length: 20,
    default: "'default'",
  })
  failureStrategy!: string

  @Column({ name: "children_count", type: "int", default: 0 })
  childrenCount!: number

  @Column({ name: "children_completed", type: "int", default: 0 })
  childrenCompleted!: number

  @Column({ type: "jsonb", nullable: true })
  result!: unknown

  @Column({ type: "jsonb", nullable: true })
  error!: unknown

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    precision: 6,
    default: () => "timezone('utc', now())",
  })
  createdAt!: Date

  @Column({
    name: "completed_at",
    type: "timestamptz",
    precision: 6,
    nullable: true,
  })
  completedAt!: Date | null
}
