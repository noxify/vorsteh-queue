# @vorsteh-queue/adapter-kysely

## 0.3.0

### Minor Changes

- aa22a40: **Dynamic Schema & Table Names**
  - All adapters (Drizzle, Kysely, Prisma) now support configurable schema and table names for queue jobs.
  - Enables an easier integration in existing DB setups.

### Patch Changes

- Updated dependencies [aa22a40]
  - @vorsteh-queue/core@0.5.0

## 0.2.0

### Minor Changes

- b18ec50: Added support for batch processing

### Patch Changes

- 35f7171: update dependencies
- Updated dependencies [66c4848]
- Updated dependencies [35f7171]
  - @vorsteh-queue/core@0.4.0

## 0.1.1

### Patch Changes

- fef15d5: use shared tests

## 0.1.0

### Minor Changes

- 73cdaf2: Add Kysely ORM adapter for PostgreSQL with type-safe database operations

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

### Patch Changes

- Updated dependencies [73cdaf2]
  - @vorsteh-queue/core@0.3.2
