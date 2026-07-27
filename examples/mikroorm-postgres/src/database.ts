import { MikroORM } from "@mikro-orm/postgresql"
import {
  QueueFlowSchema,
  QueueJobSchema,
} from "@vorsteh-queue/adapter-mikroorm"

export const orm = await MikroORM.init({
  entities: [QueueJobSchema, QueueFlowSchema],
  clientUrl: process.env.DATABASE_URL,
  allowGlobalContext: true,
})
