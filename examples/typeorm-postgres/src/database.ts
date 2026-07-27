import { QueueFlowEntity, QueueJobEntity } from "@vorsteh-queue/adapter-typeorm"
import { DataSource } from "typeorm"

export const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [QueueJobEntity, QueueFlowEntity],
  synchronize: true,
  logging: false,
})
