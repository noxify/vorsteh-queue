import { initQueueJobModel } from "@vorsteh-queue/adapter-sequelize"
import { Sequelize } from "sequelize"

export const sequelize = new Sequelize(process.env.DATABASE_URL ?? "", {
  dialect: "postgres",
  logging: false,
})

initQueueJobModel(sequelize)
