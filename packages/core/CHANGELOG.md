# @vorsteh-queue/core

## 0.4.0

### Minor Changes

- 66c4848: ### Added
  - Batch processing support: You can now register batch handlers via `queue.registerBatch`, allowing the queue to process multiple jobs at once according to configurable batch sizes and timing.
  - New `batch` configuration options: `minSize`, `maxSize`, and `waitFor` allow fine-grained control over when and how batches are processed.
  - Type-safe batch jobs: Batch jobs are strictly separated from scheduled/single jobs and **do not support** cron, delay, or repeat options.
  - Adapter API extended: All core adapters now support efficient batch operations.
  - Events for batch lifecycle: The queue emits `batch:processing`, `batch:completed`, and `batch:failed` events for batch jobs.

  **Handler exclusivity:** A queue can handle only batch jobs or single jobs — not both. Attempting to register both handler types in the same queue will throw an error. This ensures clear and predictable processing.

  #### Example

  ```ts
  import { MemoryQueueAdapter, Queue } from "@vorsteh-queue/core"

  type EmailPayload = { to: string; body: string }
  type EmailResult = { ok: boolean }

  const adapter = new MemoryQueueAdapter()
  const queue = new Queue<EmailPayload, EmailResult>(adapter, {
    name: "batch-demo",
    batch: { minSize: 5, maxSize: 20, waitFor: 1000 },
  })

  queue.registerBatch("send-emails", async (jobs) => {
    // jobs is an array of up to 20 jobs
    await sendBulkEmails(jobs.map((j) => j.payload))
    return jobs.map(() => ({ ok: true }))
  })

  // Add jobs as usual
  await queue.addJobs("send-emails", [
    { to: "a@example.com", body: "Hi A" },
    { to: "b@example.com", body: "Hi B" },
    // ...
  ])

  queue.start()
  ```

### Patch Changes

- 35f7171: update dependencies

## 0.3.2

### Patch Changes

- 73cdaf2: update dependencies

## 0.3.1

### Patch Changes

- 4716031: update JSDOC descriptions
- 8f765e3: Updated dependencies

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

## 0.2.0

### Minor Changes

- 51f5968: - Updated `BaseQueueAdapter` to use `setQueueName()` method
  - Updated `Queue` class to automatically set queue name on adapter
  - Updated `QueueAdapter` interface with optional `setQueueName()` method
  - Updated all core tests

## 0.1.0

### Minor Changes

- 8527495: # 🚀 Initial Release - Core Queue Engine

  The foundational package providing the core queue functionality and interfaces.

  ## ✨ Features
  - **Type-safe job processing** with full TypeScript support and generic job payloads
  - **Priority queue system** with numeric priority (lower = higher priority)
  - **Delayed job scheduling** for future execution with precise timing
  - **Recurring jobs** with cron expressions and interval-based repetition
  - **Timezone-aware scheduling** with automatic DST handling
  - **Real-time progress tracking** for long-running jobs (0-100%)
  - **Comprehensive event system** for monitoring job lifecycle
  - **Graceful shutdown** with clean job processing termination

  ## 🎛️ Queue Configuration
  - **Flexible job cleanup** - `removeOnComplete`/`removeOnFail` support boolean or number
  - **Configurable concurrency** - Process multiple jobs simultaneously
  - **Retry logic** with exponential backoff and max attempts
  - **Job timeouts** and comprehensive error handling
  - **Queue statistics** and health monitoring

  ## 📊 Event System
  - **Job lifecycle events**: `job:added`, `job:processing`, `job:completed`, `job:failed`, `job:retried`, `job:progress`
  - **Queue events**: `queue:paused`, `queue:resumed`, `queue:stopped`, `queue:error`
  - **Type-safe event handlers** with proper TypeScript support

  ## 🌍 Timezone Support
  - Schedule jobs in any IANA timezone with automatic DST transitions
  - Complex cron expressions with timezone awareness
  - UTC-first storage with timezone-aware calculations
  - Reliable cross-timezone job scheduling

  ## 🔌 Adapter Pattern
  - **Pluggable storage backends** - Easy to add new database adapters
  - **Consistent interface** - Same API across all storage implementations
  - **Built-in memory adapter** - Perfect for testing and development
  - **Transaction support** - Atomic job operations where supported
