---
"@vorsteh-queue/core": minor
"@vorsteh-queue/adapter-drizzle": minor
"@vorsteh-queue/adapter-prisma": minor
---

Add job result storage functionality

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
