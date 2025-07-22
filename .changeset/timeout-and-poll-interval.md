---
"@vorsteh-queue/core": minor
"@vorsteh-queue/adapter-drizzle": minor
"@vorsteh-queue/adapter-prisma": minor
---

Add configurable job timeouts and rename `processingInterval` to `pollInterval`.

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
