---
"@vorsteh-queue/drizzle-adapter": minor
---

- `PostgresQueueAdapter`: Constructor simplified
- `MariaDBQueueAdapter`: Constructor simplified

**Before (duplicate queue name)**

```ts
const adapter1 = new PostgresQueueAdapter(db, "my-queue")
const queue1 = new Queue(adapter1, { name: "my-queue" })

const adapter2 = new MariaDBQueueAdapter(db, "my-queue")
const queue2 = new Queue(adapter2, { name: "my-queue" })
```

**After (single queue name):**

```ts
const adapter1 = new PostgresQueueAdapter(db)
const queue1 = new Queue(adapter1, { name: "my-queue" })

const adapter2 = new MariaDBQueueAdapter(db)
const queue2 = new Queue(adapter2, { name: "my-queue" })
```
