---
"@vorsteh-queue/adapter-prisma": major
---

## @vorsteh-queue/adapter-prisma 1.0

### Breaking: QueueAdapter Interface Rewritten

Implements the new `QueueAdapter` interface with additional methods:

- `getJobById(id)` — retrieve a single job
- `getNextJob(options)` — now requires `handlerNames` and `activeGroups` for FIFO support
- `getNextJobsForHandler(name, count, groupConstraints)` — batch picking with group constraints
- `updateJobStatus(id, update)` — new signature with `JobStatusUpdate` object
- `cancelJob(id, reason?)` / `cancelJobs(filter)` — cancellation support
- `getDeadJobs()` / `redriveJob(id)` / `redriveJobs(filter?)` — DLQ support
- `findJobByUniqueKey(uniqueKey)` — unique job lookup
- `updateJobSteps(id, steps)` — step state persistence

### Breaking: Schema Changes (migration required)

New columns: `group_key`, `unique_key`, `cancelled_at`, `cancellation_reason`, `steps`

Changed: `timeout` from JSONB to INT (nullable, milliseconds)

Changed: `progress` from nullable to non-nullable INT (default 0)

Changed: `repeat_count` from nullable to non-nullable (default 0)

New indexes: `idx_queue_jobs_polling`, `idx_queue_jobs_delayed`, `idx_queue_jobs_active_groups`, `idx_queue_jobs_stats`

Updated `schema.prisma` with new model fields.
