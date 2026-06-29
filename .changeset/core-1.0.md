---
"@vorsteh-queue/core": major
---

## @vorsteh-queue/core 1.0

### Breaking: Queue/Worker Architecture Split

The `Queue` class is now a producer-only. Job processing is handled by the new `Worker` class.

Before:

```typescript
const queue = new Queue(adapter, { name: "my-queue" })
queue.register("job", handler)
queue.start()
```

After:

```typescript
const queue = new Queue(adapter, { name: "my-queue" })
const worker = new Worker(adapter, { name: "my-queue", concurrency: 5 })
worker.register("job", handler)
worker.start()

// Queue is now producer-only — use it to add jobs
await queue.add("job", { data: "payload" })
```

### Breaking: Handler Signature

Handlers now receive a `JobContext` with an `AbortSignal` for timeout/cancellation support.

Before: `(job) => Promise<result>`
After: `(job, { signal, step }) => Promise<result>`

### Breaking: New Statuses

Added `cancelled` and `dead` statuses. `QueueStats` now includes all 7 statuses.

### Breaking: Removed APIs

`queue.register()`, `queue.start()`, `queue.stop()`, `queue.pause()`, `queue.resume()`, `queue.enqueue()`, `queue.dequeue()`

### New Features

- Job cancellation (`queue.cancel()`, `worker.cancelJob()`)
- Dead-letter queue (`queue.getDeadJobs()`, `queue.redrive()`, `queue.redriveAll()`)
- Group FIFO ordering (`{ group: "tenant-1" }`)
- Unique job deduplication (`{ unique: { key: "...", action: "reject" | "replace" } }`)
- `enqueueAndWait()` — enqueue and wait for result (hybrid event + polling)
- Typed event emitter on both Queue and Worker
- Configurable retry strategies (exponential, linear, fixed, custom function)
- State machine validation for job status transitions
- Per-handler concurrency limits
- Job Steps (`step.run()`, `step.sleep()`, `step.all()`) for durable multi-step execution
- Job Dependencies (`dependsOn`, circular detection)
- Rate Limiting (token-bucket per handler)
