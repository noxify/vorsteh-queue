import { MikroORM } from "@mikro-orm/postgresql"
import { QueueJobSchema } from "@vorsteh-queue/adapter-mikroorm"

export const orm = await MikroORM.init({
  entities: [QueueJobSchema],
  clientUrl: process.env.DATABASE_URL,
  allowGlobalContext: true,
})
