import { DataTypes, Model } from "sequelize"
import type { Sequelize } from "sequelize"

/**
 * Sequelize model for flow nodes.
 *
 * This model maps to the `queue_flows` table and stores flow orchestration
 * data separate from queue jobs.
 *
 * @example
 * ```typescript
 * import { Sequelize } from "sequelize"
 * import { QueueFlowModel, initQueueFlowModel } from "@vorsteh-queue/adapter-sequelize"
 *
 * const sequelize = new Sequelize(process.env.DATABASE_URL)
 * initQueueFlowModel(sequelize)
 * ```
 */
export class QueueFlowModel extends Model {
  declare id: string
  declare flowId: string
  declare parentNodeId: string | null
  declare jobId: string | null
  declare queueName: string
  declare name: string
  declare payload: unknown
  declare options: unknown
  declare status: string
  declare failureStrategy: string
  declare childrenCount: number
  declare childrenCompleted: number
  declare result: unknown
  declare error: unknown
  declare createdAt: Date
  declare completedAt: Date | null
}

/**
 * Initialize the QueueFlowModel with a Sequelize instance.
 *
 * @param sequelize - The Sequelize instance to register the model with
 * @param tableName - The table name for the flow model
 * @returns The initialized QueueFlowModel class
 *
 * @example
 * ```typescript
 * import { Sequelize } from "sequelize"
 * import { initQueueFlowModel } from "@vorsteh-queue/adapter-sequelize"
 *
 * const sequelize = new Sequelize("postgresql://user:pass@localhost/db")
 * initQueueFlowModel(sequelize)
 * ```
 */
export function initQueueFlowModel(
  sequelize: Sequelize,
  tableName = "queue_flows"
): typeof QueueFlowModel {
  QueueFlowModel.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      flowId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "flow_id",
      },
      parentNodeId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "parent_node_id",
      },
      jobId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: "job_id",
      },
      queueName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "queue_name",
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      payload: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      options: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      failureStrategy: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "default",
        field: "failure_strategy",
      },
      childrenCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "children_count",
      },
      childrenCompleted: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "children_completed",
      },
      result: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      error: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE(6),
        allowNull: false,
        field: "created_at",
        defaultValue: sequelize.literal("timezone('utc', now())"),
      },
      completedAt: {
        type: DataTypes.DATE(6),
        allowNull: true,
        field: "completed_at",
      },
    },
    {
      sequelize,
      tableName,
      timestamps: false,
      indexes: [
        {
          name: "idx_queue_flows_flow_id",
          fields: ["flow_id"],
        },
        {
          name: "idx_queue_flows_parent_node_id",
          fields: ["parent_node_id"],
        },
        {
          name: "idx_queue_flows_job_id",
          fields: ["job_id"],
        },
        {
          name: "idx_queue_flows_status",
          fields: ["flow_id", "status"],
        },
      ],
    }
  )
  return QueueFlowModel
}
