import { defineRelations } from "drizzle-orm"

import * as schema from "./postgres-schema"

export const relations = defineRelations(schema, (_r) => ({
  queueJobs: {},
}))
