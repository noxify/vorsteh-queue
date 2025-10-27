# @vorsteh-queue/adapter-drizzle

## 0.4.0

### Minor Changes

- b18ec50: Added support for batch processing

### Patch Changes

- 35f7171: update dependencies
- Updated dependencies [66c4848]
- Updated dependencies [35f7171]
  - @vorsteh-queue/core@0.4.0

## 0.3.3

### Patch Changes

- fef15d5: use shared tests

## 0.3.2

### Patch Changes

- 4414f87: Add `PostgresQueueAdapter` as alias to `PostgresDrizzleQueueAdapter`
- 73cdaf2: update dependencies
- Updated dependencies [73cdaf2]
  - @vorsteh-queue/core@0.3.2

## 0.3.1

### Patch Changes

- 4716031: update JSDOC descriptions
- 8f765e3: Updated dependencies
- Updated dependencies [4716031]
- Updated dependencies [8f765e3]
  - @vorsteh-queue/core@0.3.1

## 0.3.0

### Minor Changes

- ccaacc2: Add job result storage functionality

  Job handlers can now return values that are automatically stored in the database and made available through events and job records.

  **New Features:**
  - Added optional `result` field to job records for storing handler return values
  - Enhanced `BaseJob` interface with generic result type parameter
  - Updated all adapters (Drizzle, Prisma, Memory) to support result storage
  - Results are accessible in `job:completed` events and job queries

  **Database Changes:**
  - Added `result` JSONB column to queue_jobs table in both Drizzle and Prisma schemas
  - Column is optional and backward compatible with existing jobs

  **API Changes:**
  - `JobHandler<TPayload, TResult>` now supports result type parameter
  - `updateJobStatus()` method accepts optional result parameter
  - Job completion events include result data

  **Examples:**

  ```typescript
  // Handler with typed result
  queue.register<EmailPayload, EmailResult>("send-email", async (job) => {
    await sendEmail(job.payload)
    return { messageId: "msg_123", sent: true } // Stored in job.result
  })

  // Access results in events
  queue.on("job:completed", (job) => {
    console.log("Result:", job.result) // { messageId: "msg_123", sent: true }
  })
  ```

- 5adb3a0: Add configurable job timeouts and rename `processingInterval` to `pollInterval`.

  **New Features:**
  - **Configurable job timeouts**: Set `timeout: number` for specific timeout or `timeout: false` to disable timeout completely
  - **Job-specific timeout override**: Individual jobs can override queue default timeout settings
  - **Timeout field storage**: Job timeout configuration is now stored in job records for proper handling

  **Breaking Changes:**
  - **Renamed `processingInterval` to `pollInterval`**: More accurately describes the interval between queue polling cycles
  - **Database schema changes**: Added `timeout` column to queue_jobs table (JSONB field, nullable)

  **Migration Guide:**

  ```typescript
  // Before
  const queue = new Queue(adapter, {
    name: "my-queue",
    processingInterval: 1000, // OLD
  })

  // After
  const queue = new Queue(adapter, {
    name: "my-queue",
    pollInterval: 1000, // NEW
  })

  // New timeout features
  await queue.add("long-job", payload, { timeout: false }) // Disable timeout
  await queue.add("quick-job", payload, { timeout: 5000 }) // 5 second timeout
  ```

  **Database Migration Required:**
  - **Drizzle users**: Run migrations to add `timeout` column
  - **Prisma users**: Run `prisma db push` or `prisma migrate` to apply schema changes

  **Examples:**

  ```typescript
  // Disable timeout for long-running data processing
  await queue.add("process-large-dataset", data, { timeout: false })

  // Set specific timeout for API calls
  await queue.add("external-api-call", params, { timeout: 30000 })

  // Use default timeout (30 seconds) - no change needed
  await queue.add("normal-job", payload)
  ```

  This release improves queue configuration clarity and provides flexible timeout control for different job types.

### Patch Changes

- Updated dependencies [ccaacc2]
- Updated dependencies [5adb3a0]
  - @vorsteh-queue/core@0.3.0

## 0.2.0

### Minor Changes

- 51f5968: - `PostgresQueueAdapter`: Constructor simplified
  - **BREAKING**: Removed MariaDB/MySQL support due to timezone handling complexities
    - I tried my best to make it work, but failed successfully
  - **BREAKING**: Fixed UTC-first timezone handling - all timestamps now stored as UTC

  **Before (duplicate queue name)**

  ```ts
  const adapter = new PostgresQueueAdapter(db, "my-queue")
  const queue = new Queue(adapter, { name: "my-queue" })
  ```

  **After (single queue name):**

  ```ts
  const adapter = new PostgresQueueAdapter(db)
  const queue = new Queue(adapter, { name: "my-queue" })
  ```

  **Timezone Changes:**
  - Database schema now uses UTC defaults: `timezone('utc', now())` for PostgreSQL
  - Application timestamps stored as UTC using `toISOString()::timestamptz`
  - Consistent UTC-first behavior for reliable timezone handling

### Patch Changes

- Updated dependencies [51f5968]
  - @vorsteh-queue/core@0.2.0

## 0.1.0

### Minor Changes

- 8527495: # 🚀 Initial Release - Drizzle ORM Adapter

  Database adapter supporting PostgreSQL and MariaDB/MySQL via Drizzle ORM.

  ## 🗄️ Database Support

  ### PostgreSQL
  - **PostgreSQL 12+** with SKIP LOCKED support for concurrent processing
  - **Multiple drivers**: node-postgres, postgres.js, PGlite
  - **Full feature support**: JSONB payloads, UUID primary keys, timezone-aware timestamps
  - **Connection pooling** and transaction support

  ### MariaDB/MySQL
  - **MariaDB 10.6+** and **MySQL 8.0+** with SKIP LOCKED functionality
  - **mysql2 driver** with promise support and connection pooling
  - **JSON payloads** with proper serialization/deserialization
  - **UUID compatibility** using VARCHAR(36) with MySQL UUID() function

  ## ⚡ Performance Features
  - **SKIP LOCKED** queries for high-concurrency job processing without lock contention
  - **Optimized indexes** on queue_name, status, priority, and process_at columns
  - **Efficient job retrieval** with priority-based ordering and creation time fallback
  - **Batch operations** for job cleanup and maintenance

  ## 🔧 Schema Management
  - **Exported schemas** - `postgresSchema` and `mariadbSchema` for easy integration
  - **Drizzle Kit support** - Generate and run migrations with your existing schema
  - **Type-safe queries** - Full TypeScript support with Drizzle's query builder
  - **Flexible integration** - Works with existing Drizzle setups

  ## 📦 Easy Integration

  **with PostgreSQL:**

  ```typescript
  // PostgreSQL
  import { PostgresQueueAdapter, postgresSchema } from "@vorsteh-queue/adapter-drizzle"

  const db = drizzle(pool, { schema: postgresSchema })
  const adapter = new PostgresQueueAdapter(db, "my-queue")
  ```

  **with MariaDB/MySQL:**

  ```
  // MariaDB/MySQL
  import { MariaDBQueueAdapter, mariadbSchema } from "@vorsteh-queue/adapter-drizzle"
  const db = drizzle(connection, { schema: mariadbSchema })
  const adapter = new MariaDBQueueAdapter(db, "my-queue")
  ```

### Patch Changes

- Updated dependencies [8527495]
  - @vorsteh-queue/core@0.1.0
