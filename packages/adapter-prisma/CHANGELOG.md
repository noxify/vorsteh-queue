# @vorsteh-queue/adapter-prisma

## 0.2.1

### Patch Changes

- 4716031: update JSDOC descriptions
- 8f765e3: Updated dependencies
- Updated dependencies [4716031]
- Updated dependencies [8f765e3]
  - @vorsteh-queue/core@0.3.1

## 0.2.0

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

## 0.1.0

### Minor Changes

- 61c0f7b: Initial Prisma adapter release with UTC-first timezone support

  **Features:**
  - `PostgresPrismaQueueAdapter`: PostgreSQL support using Prisma ORM
  - Raw SQL with `SKIP LOCKED` for race condition prevention
  - UTC-first design with proper timezone handling
  - Database schema uses UTC defaults: `timezone('utc', now())` for PostgreSQL
  - All timestamps explicitly stored as UTC for consistent behavior

  **Usage:**

  ```typescript
  import { PrismaClient } from "@prisma/client"

  import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
  import { Queue } from "@vorsteh-queue/core"

  const prisma = new PrismaClient()
  const adapter = new PostgresPrismaQueueAdapter(prisma)
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

- Updated dependencies [51f5968]
  - @vorsteh-queue/core@0.2.0
