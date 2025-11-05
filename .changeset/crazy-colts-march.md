---
"@vorsteh-queue/adapter-drizzle": minor
"@vorsteh-queue/adapter-kysely": minor
"@vorsteh-queue/adapter-prisma": minor
"@vorsteh-queue/core": minor
---

## Dynamic Schema & Table Names

- All adapters (Drizzle, Kysely, Prisma) now support configurable schema and table names for queue jobs.
- Enables an easier integration in existing DB setups.

## Example: Drizzle Adapter with Custom Schema & Table

```typescript
// drizzle-schema.ts
import { createQueueJobsTable } from "@vorsteh-queue/adapter-drizzle"

export const { table: customQueueJobs, schema: customSchema } = createQueueJobsTable(
  "custom_queue_jobs",
  "custom_schema",
)

// queue.ts
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "src/drizzle-schema.ts2

import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema })

const adapter = new PostgresQueueAdapter(db, {
  modelName: "customQueueJobs",
})

// The queue will now use the specified schema and table
const queue = new Queue(adapter, { name: "my-queue" })
```
