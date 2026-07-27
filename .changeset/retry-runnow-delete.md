---
"@vorsteh-queue/core": minor
"@vorsteh-queue/adapter-drizzle": minor
"@vorsteh-queue/adapter-kysely": minor
"@vorsteh-queue/adapter-prisma": minor
"@vorsteh-queue/server": minor
"@vorsteh-queue/cli": minor
---

## New operations: retry, runNow, deleteJob

Added three new job management operations across the full stack:

- **`retry(jobId)`** — resets a `failed` job to `pending` (clears error, resets attempts to 0)
- **`runNow(jobId)`** — promotes a `delayed` job to `pending` immediately (sets processAt to now)
- **`deleteJob(jobId)`** — permanently removes a single job by ID

Available on:

- `Queue` class: `queue.retry()`, `queue.runNow()`, `queue.deleteJob()`
- `QueueAdapter` interface: `retryJob()`, `runJobNow()`, `deleteJob()`
- GraphQL API: mutations `retryJob`, `runJobNow`, `deleteJob`
- CLI: commands `retry`, `run-now`, `delete`
