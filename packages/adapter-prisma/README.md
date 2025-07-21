# @vorsteh-queue/adapter-prisma

Prisma ORM adapter for Vorsteh Queue supporting PostgreSQL databases.

## Features

- **PostgreSQL Support**: Full PostgreSQL compatibility with Prisma ORM
- **Type Safety**: Full TypeScript support with Prisma Client
- **SKIP LOCKED**: Concurrent job processing without lock contention using raw SQL
- **JSON Payloads**: Complex data structures with proper serialization
- **UTC-First**: All timestamps stored as UTC for reliable timezone handling

## Requirements

- **Node.js 20+**
- **PostgreSQL 12+** (for SKIP LOCKED support)
- **ESM only** - This package is ESM-only and cannot be imported with `require()`

## Installation

```bash
npm install @vorsteh-queue/adapter-prisma @prisma/client
# or
pnpm add @vorsteh-queue/adapter-prisma @prisma/client
```

> **Note**: Make sure your project has `"type": "module"` in package.json or use `.mjs` file extensions.

## Usage

```typescript
import { PrismaClient } from "@prisma/client"

import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"
import { Queue } from "@vorsteh-queue/core"

// Setup Prisma client
const prisma = new PrismaClient()

interface EmailPayload {
  to: string
  subject: string
  body: string
}

interface EmailResult {
  messageId: string
  sent: boolean
}

// Create adapter and queue
const adapter = new PostgresPrismaQueueAdapter(prisma)
const queue = new Queue(adapter, { name: "my-queue" })

// Register job handlers
queue.register<EmailPayload, EmailResult>("send-email", async (job) => {
  console.log(`Sending email to ${job.payload.to}`)

  // Send email logic here
  // await sendEmail(job.payload)

  return {
    messageId: "msg_123",
    sent: true,
  }
})

// Add jobs
await queue.add("send-email", {
  to: "user@example.com",
  subject: "Welcome!",
  body: "Welcome to our service!",
})

// Start processing
queue.start()
```

## Schema Setup

Add the queue jobs table to your Prisma schema:

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Your existing models
model User {
  id   Int    @id @default(autoincrement())
  name String
  // ... your fields
}

// Queue jobs table
model QueueJob {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  queueName    String    @map("queue_name") @db.VarChar(255)
  name         String    @db.VarChar(255)
  payload      Json
  status       String    @db.VarChar(50)
  priority     Int
  attempts     Int       @default(0)
  maxAttempts  Int       @map("max_attempts")
  createdAt    DateTime  @default(dbgenerated("timezone('utc', now())")) @map("created_at") @db.Timestamptz
  processAt    DateTime  @map("process_at") @db.Timestamptz
  processedAt  DateTime? @map("processed_at") @db.Timestamptz
  completedAt  DateTime? @map("completed_at") @db.Timestamptz
  failedAt     DateTime? @map("failed_at") @db.Timestamptz
  error        Json?
  progress     Int?      @default(0)
  cron         String?   @db.VarChar(255)
  repeatEvery  Int?      @map("repeat_every")
  repeatLimit  Int?      @map("repeat_limit")
  repeatCount  Int       @default(0) @map("repeat_count")

  @@index([queueName, status, priority, createdAt], map: "idx_queue_jobs_status_priority")
  @@index([processAt], map: "idx_queue_jobs_process_at")
  @@map("queue_jobs")
}
```

```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma db push
# or
npx prisma migrate dev
```

## Performance Notes

This adapter uses raw SQL with `SKIP LOCKED` for critical job selection operations to prevent race conditions in concurrent processing scenarios. Regular Prisma operations are used for other database interactions.

## Testing

```bash
pnpm test
```

## License

MIT License - see LICENSE file for details.
