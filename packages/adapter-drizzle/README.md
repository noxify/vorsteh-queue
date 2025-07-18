# @vorsteh-queue/adapter-drizzle

Drizzle ORM adapter for Vorsteh Queue supporting PostgreSQL and MariaDB/MySQL databases.

## Features

- **PostgreSQL Support**: Full PostgreSQL compatibility with PGlite, node-postgres, and postgres.js
- **MariaDB/MySQL Support**: MariaDB 10.6+ and MySQL 8.0+ with SKIP LOCKED functionality
- **Type Safety**: Full TypeScript support with Drizzle ORM
- **SKIP LOCKED**: Concurrent job processing without lock contention
- **JSON Payloads**: Complex data structures with proper serialization
- **UTC-First**: All timestamps stored as UTC for reliable timezone handling

## Installation

```bash
npm install @vorsteh-queue/adapter-drizzle drizzle-orm
# or
pnpm add @vorsteh-queue/adapter-drizzle drizzle-orm
```

## PostgreSQL Usage

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

// Create adapter and queue
const adapter = new PostgresQueueAdapter(db, "my-queue")
const queue = new Queue(adapter, { name: "my-queue" })

// Register job handlers
queue.register("send-email", async (payload: { to: string; subject: string }) => {
  // Send email logic
  return { sent: true }
})

// Add jobs
await queue.add("send-email", { to: "user@example.com", subject: "Welcome!" })

// Start processing
queue.start()
```

## MariaDB/MySQL Usage

```typescript
import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"

import { MariaDBQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

// Setup MariaDB/MySQL connection
const connection = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "password",
  database: "queue_db",
})
const db = drizzle(connection, { mode: "default" })

// Create adapter and queue
const adapter = new MariaDBQueueAdapter(db, "my-queue")
const queue = new Queue(adapter, { name: "my-queue" })

// Same API as PostgreSQL!
queue.register("process-data", async (payload: { items: string[] }) => {
  // Process data logic
  return { processed: payload.items.length }
})

await queue.add("process-data", { items: ["item1", "item2", "item3"] })
queue.start()
```

## Database Requirements

### PostgreSQL

- **PostgreSQL 12+** (for SKIP LOCKED support)
- **PGlite** (for embedded/testing)
- **Drivers**: node-postgres, postgres.js

### MariaDB/MySQL

- **MariaDB 10.6+** (for SKIP LOCKED support)
- **MySQL 8.0+** (for SKIP LOCKED support)
- **Driver**: mysql2

## Schema Setup

You need to create the required database tables before using the adapter. Here are the recommended approaches:

### Using Drizzle Schemas (Recommended)

**PostgreSQL**

```typescript
import { drizzle } from "drizzle-orm/node-postgres"

import { postgresSchema } from "@vorsteh-queue/adapter-drizzle"

const db = drizzle(pool, { schema: postgresSchema })
```

**MariaDB/MySQL**

```typescript
import { drizzle } from "drizzle-orm/mysql2"

import { mariadbSchema } from "@vorsteh-queue/adapter-drizzle"

const db = drizzle(connection, { schema: mariadbSchema, mode: "default" })
```

### Using Drizzle Kit Migrations

Integrate the queue schema with your existing application schema:

**PostgreSQL Example:**

```typescript
// src/schema/index.ts - Your application schema
import { pgTable, serial, varchar } from "drizzle-orm/pg-core"

import { postgresSchema } from "@vorsteh-queue/adapter-drizzle"

// Your existing tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  // ... your fields
})

// Export queue schema alongside your schema
export const queueJobs = postgresSchema.queueJobs

// Or re-export everything
export * from "@vorsteh-queue/adapter-drizzle/postgres-schema"
```

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/schema/index.ts", // Your combined schema
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // your database credentials
  },
})
```

**MariaDB/MySQL Example:**

```typescript
// src/schema/index.ts - Your application schema
import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core"

import { mariadbSchema } from "@vorsteh-queue/adapter-drizzle"

// Your existing tables
export const users = mysqlTable("users", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }),
  // ... your fields
})

// Export queue schema alongside your schema
export const queueJobs = mariadbSchema.queueJobs

// Or re-export everything
export * from "@vorsteh-queue/adapter-drizzle/mariadb-schema"
```

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/schema/index.ts", // Your combined schema
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    // your database credentials
  },
})
```

```bash
# Generate and run migrations
npx drizzle-kit generate
npx drizzle-kit migrate
```

### Manual Schema Definition

#### PostgreSQL Schema

```typescript
import { sql } from "drizzle-orm"
import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

export const queueJobs = pgTable(
  "queue_jobs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    queueName: varchar("queue_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    priority: integer("priority").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processAt: timestamp("process_at", { withTimezone: true }).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    error: jsonb("error"),
    progress: integer("progress").default(0),
    cron: varchar("cron", { length: 255 }),
    repeatEvery: integer("repeat_every"),
    repeatLimit: integer("repeat_limit"),
    repeatCount: integer("repeat_count").default(0),
  },
  (table) => [
    index("idx_queue_jobs_status_priority").on(
      table.queueName,
      table.status,
      table.priority,
      table.createdAt,
    ),
    index("idx_queue_jobs_process_at").on(table.processAt),
  ],
)
```

#### MariaDB/MySQL Schema

```typescript
import { sql } from "drizzle-orm"
import { index, int, json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core"

export const queueJobs = mysqlTable(
  "queue_jobs",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .default(sql`(UUID())`),
    queueName: varchar("queue_name", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    payload: json("payload").notNull(),
    status: varchar("status", { length: 50 }).notNull(),
    priority: int("priority").notNull(),
    attempts: int("attempts").default(0).notNull(),
    maxAttempts: int("max_attempts").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    processAt: timestamp("process_at").notNull(),
    processedAt: timestamp("processed_at"),
    completedAt: timestamp("completed_at"),
    failedAt: timestamp("failed_at"),
    error: json("error"),
    progress: int("progress").default(0),
    cron: varchar("cron", { length: 255 }),
    repeatEvery: int("repeat_every"),
    repeatLimit: int("repeat_limit"),
    repeatCount: int("repeat_count").default(0),
  },
  (table) => [
    index("idx_queue_jobs_status_priority").on(
      table.queueName,
      table.status,
      table.priority,
      table.createdAt,
    ),
    index("idx_queue_jobs_process_at").on(table.processAt),
  ],
)
```

## Available Adapters

```typescript
// PostgreSQL adapter
// MariaDB/MySQL adapter
import { MariaDBQueueAdapter, PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
```

## Testing

```bash
# Test PostgreSQL adapter (PGlite)
pnpm test:postgres

# Test MariaDB adapter (Testcontainers)
pnpm test:mariadb

# Test all
pnpm test
```

## Key Differences

| Feature           | PostgreSQL                   | MariaDB/MySQL             |
| ----------------- | ---------------------------- | ------------------------- |
| **UUID**          | `UUID` + `gen_random_uuid()` | `VARCHAR(36)` + `UUID()`  |
| **JSON**          | `JSONB` (binary)             | `JSON` (text)             |
| **Timestamps**    | `TIMESTAMP WITH TIME ZONE`   | `TIMESTAMP`               |
| **Insert Result** | `RETURNING` clause           | `insertId` property       |
| **SKIP LOCKED**   | PostgreSQL 9.5+              | MariaDB 10.6+, MySQL 8.0+ |

## License

MIT License - see LICENSE file for details.
