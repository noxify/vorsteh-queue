import { QueueJobEntity } from "@vorsteh-queue/adapter-typeorm"
import { DataSource } from "typeorm"

export const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [QueueJobEntity],
  synchronize: true,
  logging: false,
})
