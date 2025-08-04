---
"@vorsteh-queue/adapter-kysely": minor
---

Add Kysely ORM adapter for PostgreSQL with type-safe database operations

**Features:**

- `PostgresQueueAdapter`: PostgreSQL support using Kysely ORM
- Raw SQL with `SKIP LOCKED` for race condition prevention
- UTC-first design with proper timezone handling
- Database schema uses UTC defaults: `timezone('utc', now())` for PostgreSQL
- All timestamps explicitly stored as UTC for consistent behavior

**Usage:**

```typescript
import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"

import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-kysely"
import { Queue } from "@vorsteh-queue/core"

const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: "postgresql://..." }),
  }),
})

const adapter = new PostgresQueueAdapter(db)
const queue = new Queue(adapter, { name: "my-queue" })

// Register job handlers
queue.register("send-email", async (payload: { to: string }) => {
  // Send email logic
  return { sent: true }
})

// Add jobs
await queue.add("send-email", { to: "user@example.com" })

// Start processing
queue.start()
```
