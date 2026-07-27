import { defineRelations } from "drizzle-orm"

import * as schema from "./test-schema"

export const testRelations = defineRelations(schema)
