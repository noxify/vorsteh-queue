---
"@vorsteh-queue/adapter-prisma": minor
---

Initial Prisma adapter release with UTC-first timezone support

**Features:**
- `PostgresPrismaQueueAdapter`: PostgreSQL support using Prisma ORM
- Raw SQL with `SKIP LOCKED` for race condition prevention
- UTC-first design with proper timezone handling
- Database schema uses UTC defaults: `timezone('utc', now())` for PostgreSQL
- All timestamps explicitly stored as UTC for consistent behavior

**Usage:**

```typescript
import { PrismaClient } from '@prisma/client'
import { PostgresPrismaQueueAdapter } from '@vorsteh-queue/adapter-prisma'
import { Queue } from '@vorsteh-queue/core'

const prisma = new PrismaClient()
const adapter = new PostgresPrismaQueueAdapter(prisma)
const queue = new Queue(adapter, { name: 'my-queue' })

// Register job handlers
queue.register('send-email', async (payload: { to: string }) => {
  // Send email logic
  return { sent: true }
})

// Add jobs
await queue.add('send-email', { to: 'user@example.com' })

// Start processing
queue.start()
```
