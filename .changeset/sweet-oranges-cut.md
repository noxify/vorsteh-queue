---
"@vorsteh-queue/core": minor
---

### Added

- Batch processing support: You can now register batch handlers via `queue.registerBatch`, allowing the queue to process multiple jobs at once according to configurable batch sizes and timing.
- New batch configuration options: `minSize`, `maxSize`, and `waitFor` allow fine-grained control over when and how batches are processed.
- Type-safe batch jobs: Batch jobs are strictly separated from scheduled jobs and **do not support** cron, delay, or repeat options.
- Adapter API extended: All core adapters now support efficient batch operations.
- Events for batch lifecycle: The queue emits `batch:processing`, `batch:completed`, and `batch:failed` events for batch jobs.

This enables efficient, high-throughput processing for workloads that benefit from batching, such as bulk database writes or external API calls.

#### Example

```ts
import { MemoryQueueAdapter, Queue } from "@vorsteh-queue/core"

type EmailPayload = { to: string; body: string }
type EmailResult = { ok: true }

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
