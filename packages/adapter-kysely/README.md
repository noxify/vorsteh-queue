# @vorsteh-queue/adapter-kysely

Kysely ORM adapter for Vorsteh Queue supporting PostgreSQL databases.

## Features

- **PostgreSQL Support**: Full PostgreSQL compatibility with node-postgres and other drivers
- **Type Safety**: Full TypeScript support with Kysely ORM
- **SKIP LOCKED**: Concurrent job processing without lock contention
- **JSON Payloads**: Complex data structures with proper serialization
- **UTC-First**: All timestamps stored as UTC for reliable timezone handling

## Requirements

- **Node.js 20+**
- **PostgreSQL 12+** (for SKIP LOCKED support)
- **ESM only** - This package is ESM-only and cannot be imported with `require()`

## Installation

```bash
npm install @vorsteh-queue/adapter-kysely kysely
# or
pnpm add @vorsteh-queue/adapter-kysely kysely
```

> **Note**: Make sure your project has `"type": "module"` in package.json or use `.mjs` file extensions.

## Usage

```typescript
import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"

import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-kysely"
import { Queue } from "@vorsteh-queue/core"

// Setup PostgreSQL connection
const db = new Kysely({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: "postgresql://user:password@localhost:5432/database",
    }),
  }),
})

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
const adapter = new PostgresQueueAdapter(db)
const queue = new Queue(adapter, { name: "my-queue" })

// Register job handlers
queue.register<EmailPayload, EmailResult>("send-email", async (job) => {
  console.log(`Sending email to ${job.payload.to}`)

  // Send email logic here
  await sendEmail(job.payload)

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

### Using Kysely Migrations

The adapter includes migration files that you can run using Kysely's migration system.

Create a new migration file for the `queue_table` and copy the following code into the new created file.

```typescript
// src/migrations/queue_table.ts
export {up, down} from "@vorsteh-queue/adapter-kysely/migrations
```

### Manual Schema Creation

```ts
// src/migrations/queue_table.ts
import type { Kysely } from "kysely"
import { sql } from "kysely"

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("queue_jobs")
    .addColumn("id", "uuid", (col) => col.defaultTo(sql`gen_random_uuid()`).notNull())
    .addColumn("queue_name", "varchar(255)", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("status", "varchar(50)", (col) => col.notNull())
    .addColumn("priority", "int4", (col) => col.notNull())
    .addColumn("attempts", "int4", (col) => col.defaultTo(0).notNull())
    .addColumn("max_attempts", "int4", (col) => col.notNull())
    .addColumn("cron", "varchar(255)")
    .addColumn("created_at", "timestamptz", (col) =>
      col.defaultTo(sql`timezone('utc'::text, now())`).notNull(),
    )
    .addColumn("process_at", "timestamptz", (col) => col.notNull())
    .addColumn("processed_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("error", "jsonb")
    .addColumn("result", "jsonb")
    .addColumn("progress", "int4")
    .addColumn("repeat_every", "int4")
    .addColumn("repeat_limit", "int4")
    .addColumn("repeat_count", "int4")
    .execute()

  await db.schema
    .createIndex("idx_queue_jobs_status_priority")
    .on("queue_jobs")

    .columns(["queue_name", "status", "priority", "created_at"])
    .execute()

  await db.schema
    .createIndex("idx_queue_jobs_process_at")
    .on("queue_jobs")

    .column("process_at")
    .execute()
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("queue_jobs").execute()
}
```

## Supported PostgreSQL Drivers

- **node-postgres** (`pg`)
- **postgres.js** (`postgres`)
- **pglite**
- Any Kysely-compatible PostgreSQL driver

## Testing

```bash
pnpm test
```

## License

MIT License - see LICENSE file for details.
