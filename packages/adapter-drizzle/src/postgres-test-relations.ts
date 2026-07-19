import { defineRelations } from "drizzle-orm"

import * as schema from "./postgres-test-schema"

export const testRelations = defineRelations(schema)
