---
"@vorsteh-queue/adapter-drizzle": minor
"@vorsteh-queue/adapter-kysely": minor
"@vorsteh-queue/adapter-prisma": minor
"@vorsteh-queue/core": minor
---

## Highlights

- **Dynamic Schema & Table Names:**
  - All adapters (Drizzle, Kysely, Prisma) now support configurable schema and table names for queue jobs.
  - Enables an easier integration in existing DB setups.

- **Type-Safe Adapter Results:**
  - Adapter methods use improved type inference for job rows/results, even with dynamic models.
  - Ensures type safety for all job operations and migrations.

## Example: Drizzle Adapter with Custom Schema & Table

```typescript
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

const adapter = new PostgresQueueAdapter(db, {
  modelName: "customQueueJobs",
  schemaName: "custom_schema",
  tableName: "custom_queue_jobs",
})

// The queue will now use the specified schema and table
const queue = new Queue(adapter, { name: "my-queue" })
```
