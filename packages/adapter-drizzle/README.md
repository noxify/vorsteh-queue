# @vorsteh-queue/adapter-drizzle

Drizzle ORM adapter for Vorsteh Queue supporting PostgreSQL databases.

## Features

- **PostgreSQL Support**: Full PostgreSQL compatibility with PGlite, node-postgres, and postgres.js
- **Type Safety**: Full TypeScript support with Drizzle ORM
- **SKIP LOCKED**: Concurrent job processing without lock contention
- **JSON Payloads**: Complex data structures with proper serialization
- **UTC-First**: All timestamps stored as UTC for reliable timezone handling

## Requirements

- **Node.js 20+**
- **PostgreSQL 12+** (for SKIP LOCKED support)
- **ESM only** - This package is ESM-only and cannot be imported with `require()`

## Installation

```bash
npm install @vorsteh-queue/adapter-drizzle drizzle-orm
# or
pnpm add @vorsteh-queue/adapter-drizzle drizzle-orm
```

> **Note**: Make sure your project has `"type": "module"` in package.json or use `.mjs` file extensions.

## Usage

```typescript
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

// Setup PostgreSQL connection
const pool = new Pool({
  connectionString: "postgresql://user:password@localhost:5432/database",
})
const db = drizzle(pool)

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

### Using Drizzle Schemas (Recommended)

```typescript
import { drizzle } from "drizzle-orm/node-postgres"

import { postgresSchema } from "@vorsteh-queue/adapter-drizzle"

const db = drizzle(pool, { schema: postgresSchema })
```

### Using Drizzle Kit Migrations

```typescript
// src/schema/index.ts - Your application schema
import { pgTable, serial, varchar } from "drizzle-orm/pg-core"

import { postgresSchema } from "@vorsteh-queue/adapter-drizzle"

// Your existing tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
})

// Export queue schema alongside your schema
export const queueJobs = postgresSchema.queueJobs
```

```bash
# Generate and run migrations
npx drizzle-kit generate
npx drizzle-kit migrate
```

## Supported PostgreSQL Drivers

- **node-postgres** (`pg`)
- **postgres.js** (`postgres`)
- **PGlite** (for embedded/testing)

## Custom tablename & schema

Previously, we had static values for the table and assumed that the table is located in the `public` schema.

Now, you can customize these values.

```typescript
// src/schema/index.ts - Your application schema
import { pgSchema, pgTable, serial, varchar } from "drizzle-orm/pg-core"

import { postgresSchema } from "@vorsteh-queue/adapter-drizzle"

// Your existing tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
})

// Export queue schema alongside your schema
export const customQueueJobs = postgresSchema.queueJobs
```

## Testing

```bash
pnpm test
```

## License

MIT License - see LICENSE file for details.
