import { DataTypes, Model } from "sequelize"
import type { Sequelize } from "sequelize"

/**
 * Sequelize model for queue jobs.
 *
 * Use `initQueueJobModel` to register this model with a Sequelize instance.
 *
 * @example
 * ```typescript
 * import { Sequelize } from "sequelize"
 * import { QueueJobModel, initQueueJobModel } from "@vorsteh-queue/adapter-sequelize/model"
 *
 * const sequelize = new Sequelize(process.env.DATABASE_URL)
 * initQueueJobModel(sequelize)
 * ```
 */
export class QueueJobModel extends Model {
  declare id: string
  declare queueName: string
  declare name: string
  declare payload: unknown
  declare status: string
  declare priority: number
  declare attempts: number
  declare maxAttempts: number
  declare timeout: number | null
  declare progress: number
  declare groupKey: string | null
  declare uniqueKey: string | null
  declare cron: string | null
  declare repeatEvery: number | null
  declare repeatLimit: number | null
  declare repeatCount: number
  declare cancellationReason: string | null
  declare flowNodeId: string | null
  declare error: unknown
  declare result: unknown
  declare steps: unknown
  declare signals: unknown
  declare createdAt: Date
  declare processAt: Date
  declare processedAt: Date | null
  declare completedAt: Date | null
  declare failedAt: Date | null
  declare cancelledAt: Date | null
}

/**
 * Initialize the QueueJobModel with a Sequelize instance.
 *
 * @param sequelize - The Sequelize instance to register the model with
 * @param tableName - The table name for the model
 * @returns The initialized QueueJobModel class
 *
 * @example
 * ```typescript
 * import { Sequelize } from "sequelize"
 * import { initQueueJobModel } from "@vorsteh-queue/adapter-sequelize/model"
 *
 * const sequelize = new Sequelize("postgresql://user:pass@localhost/db")
 * initQueueJobModel(sequelize)
 * ```
 */
export function initQueueJobModel(
  sequelize: Sequelize,
  tableName = "queue_jobs"
): typeof QueueJobModel {
  QueueJobModel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      queueName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "queue_name",
      },
      name: { type: DataTypes.STRING(255), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false },
      status: { type: DataTypes.STRING(50), allowNull: false },
      priority: { type: DataTypes.INTEGER, allowNull: false },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: "max_attempts",
      },
      timeout: { type: DataTypes.INTEGER, allowNull: true },
      progress: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      groupKey: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "group_key",
      },
      uniqueKey: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "unique_key",
      },
      cron: { type: DataTypes.STRING(255), allowNull: true },
      repeatEvery: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "repeat_every",
      },
      repeatLimit: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: "repeat_limit",
      },
      repeatCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "repeat_count",
      },
      cancellationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "cancellation_reason",
      },
      flowNodeId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "flow_node_id",
      },
      error: { type: DataTypes.JSONB, allowNull: true },
      result: { type: DataTypes.JSONB, allowNull: true },
      steps: { type: DataTypes.JSONB, allowNull: true },
      signals: { type: DataTypes.JSONB, allowNull: true },
      createdAt: {
        type: DataTypes.DATE(6),
        allowNull: false,
        field: "created_at",
        defaultValue: sequelize.literal("timezone('utc', now())"),
      },
      processAt: {
        type: DataTypes.DATE(6),
        allowNull: false,
        field: "process_at",
      },
      processedAt: {
        type: DataTypes.DATE(6),
        allowNull: true,
        field: "processed_at",
      },
      completedAt: {
        type: DataTypes.DATE(6),
        allowNull: true,
        field: "completed_at",
      },
      failedAt: {
        type: DataTypes.DATE(6),
        allowNull: true,
        field: "failed_at",
      },
      cancelledAt: {
        type: DataTypes.DATE(6),
        allowNull: true,
        field: "cancelled_at",
      },
    },
    {
      sequelize,
      tableName,
      timestamps: false,
      indexes: [
        {
          name: "idx_queue_jobs_polling",
          fields: ["queue_name", "status", "priority", "created_at"],
        },
        {
          name: "idx_queue_jobs_delayed",
          fields: ["queue_name", "process_at"],
        },
        {
          name: "idx_queue_jobs_active_groups",
          fields: ["queue_name", "group_key"],
        },
        {
          name: "idx_queue_jobs_stats",
          fields: ["queue_name", "status"],
        },
      ],
    }
  )
  return QueueJobModel
}
