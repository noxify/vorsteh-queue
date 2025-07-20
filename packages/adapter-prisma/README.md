# @vorsteh-queue/adapter-prisma

Prisma adapter for Vorsteh Queue with support for PostgreSQL and MySQL/MariaDB.

## Features

- **Database-agnostic**: Separate adapters for PostgreSQL and MySQL/MariaDB
- **Minimal interface**: Uses a minimal Prisma client interface for better type safety
- **SKIP LOCKED support**: Efficient job locking using database-specific raw SQL
- **Type-safe**: Full TypeScript support with generic job payloads

## Installation

```bash
npm install @vorsteh-queue/adapter-prisma @vorsteh-queue/core
```

## Database Schema

Add this model to your `schema.prisma` file:

```prisma
model QueueJob {
  id           String    @id @default(cuid())
  queueName    String    @map("queue_name")
  name         String
  payload      String    // JSON string
  status       String
  priority     Int
  attempts     Int       @default(0)
  maxAttempts  Int       @map("max_attempts")
  createdAt    DateTime  @default(now()) @map("created_at")
  processAt    DateTime  @map("process_at")
  processedAt  DateTime? @map("processed_at")
  completedAt  DateTime? @map("completed_at")
  failedAt     DateTime? @map("failed_at")
  error        String?
  progress     Int?      @default(0)
  cron         String?
  repeatEvery  Int?      @map("repeat_every")
  repeatLimit  Int?      @map("repeat_limit")
  repeatCount  Int?      @default(0) @map("repeat_count")

  @@index([queueName, status, priority, createdAt])
  @@index([processAt])
  @@map("queue_jobs")
}
```

## Usage

### PostgreSQL

```typescript
import { PrismaClient } from "@prisma/client"

import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
import { Queue } from "@vorsteh-queue/core"

const prisma = new PrismaClient()
const queue = new Queue(new PostgresPrismaQueueAdapter(prisma), {
  name: "my-queue",
})

// Register job handlers
queue.register("send-email", async ({ payload }) => {
  // Send email logic
  return { sent: true }
})

// Add jobs
await queue.add("send-email", { to: "user@example.com", subject: "Welcome!" })

// Start processing
queue.start()
```

### MySQL/MariaDB

```typescript
import { PrismaClient } from "@prisma/client"

import { MySQLPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
import { Queue } from "@vorsteh-queue/core"

const prisma = new PrismaClient()
const queue = new Queue(new MySQLPrismaQueueAdapter(prisma), {
  name: "my-queue",
})

// Same API as PostgreSQL
```

## Requirements

- **PostgreSQL**: Any version supported by Prisma
- **MySQL**: Any version supported by Prisma
- **MariaDB**: Any version supported by Prisma

> **Note**: This adapter uses Prisma's built-in methods instead of raw SQL for maximum compatibility across database versions.

## Type Safety

The adapter uses a generic approach inspired by [better-auth](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/adapters/prisma-adapter/prisma-adapter.ts) that accepts any PrismaClient without requiring specific types:

```typescript
import { PrismaClient } from "@prisma/client"

import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"

// Any PrismaClient works automatically
const prisma = new PrismaClient()
const adapter = new PostgresPrismaQueueAdapter(prisma)
// Optional: Configure model name if different from default
// const adapter = new PostgresPrismaQueueAdapter(prisma, {
//  modelName: "CustomQueueJob",
// })
```

## Differences from Drizzle Adapter

- Uses Prisma ORM instead of Drizzle
- Requires manual schema definition in `schema.prisma`
- Uses Prisma's built-in methods for maximum compatibility
- Separate adapters for PostgreSQL and MySQL/MariaDB
- No database version restrictions (works with any Prisma-supported version)

## License

MIT
