---
"@vorsteh-queue/adapter-drizzle": minor
---

- `PostgresQueueAdapter`: Constructor simplified
- **BREAKING**: Removed MariaDB/MySQL support due to timezone handling complexities
  - I tried my best to make it work, but failed successfully
- **BREAKING**: Fixed UTC-first timezone handling - all timestamps now stored as UTC

**Before (duplicate queue name)**

```ts
const adapter = new PostgresQueueAdapter(db, "my-queue")
const queue = new Queue(adapter, { name: "my-queue" })
```

**After (single queue name):**

```ts
const adapter = new PostgresQueueAdapter(db)
const queue = new Queue(adapter, { name: "my-queue" })
```

**Timezone Changes:**

- Database schema now uses UTC defaults: `timezone('utc', now())` for PostgreSQL
- Application timestamps stored as UTC using `toISOString()::timestamptz`
- Consistent UTC-first behavior for reliable timezone handling
