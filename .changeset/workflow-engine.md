---
"@vorsteh-queue/core": minor
---

## Workflow Engine Features

### Saga Compensation

Steps can declare `compensate` functions that run in reverse order when a later step fails:

```typescript
await step.run("charge", () => payments.charge(amount), {
  compensate: (result) => payments.refund(result.txId),
})
```

### Signals / Human-in-the-Loop

Jobs can pause and wait for an external signal:

```typescript
const approval = await step.waitFor("approval", "manager-decision", {
  timeout: "24h",
})
// External: await queue.signal(jobId, "manager-decision", { approved: true })
```

### Event Triggers

Automatically create follow-up jobs on completion:

```typescript
worker.trigger({
  on: "order",
  create: "send-receipt",
  data: (result, job) => ({ email: result.email }),
  condition: (result) => result.total > 0,
})
```
