# Queue Package

A TypeScript-first, ORM-agnostic queue system with adapter pattern support for Prisma, Drizzle, and other ORMs.

## Features

- **Type-safe**: Full TypeScript support with strict typing
- **ORM-agnostic**: Adapter pattern supports any database ORM
- **Priority queues**: Support for job priorities (low, normal, high, critical)
- **Delayed jobs**: Schedule jobs to run at specific times
- **Retry logic**: Configurable retry attempts with exponential backoff
- **Event system**: Listen to job lifecycle events
- **Concurrency control**: Configure how many jobs run simultaneously
- **Memory adapter**: Built-in memory adapter for testing

## Requirements

- **Node.js 20+**
- **ESM only** - This package is ESM-only and cannot be imported with `require()`

## Installation

```bash
npm install @vorsteh-queue/core
```

> **Note**: Make sure your project has `"type": "module"` in package.json or use `.mjs` file extensions.

## Quick Start

```typescript
import { MemoryQueueAdapter, Queue } from "@your-org/queue"

const adapter = new MemoryQueueAdapter("my-queue")
const queue = new Queue(adapter, {
  name: "my-queue",
  concurrency: 2,
})

// Register job handler
queue.register("send-email", async (payload: { to: string; subject: string }) => {
  // Your email sending logic
  return { messageId: "abc123" }
})

// Start processing
await queue.connect()
await queue.start()

// Add job
await queue.add("send-email", {
  to: "user@example.com",
  subject: "Welcome!",
})
```

## Adapters

### Memory Adapter (Built-in)

```typescript
import { MemoryQueueAdapter } from "@your-org/queue"

const adapter = new MemoryQueueAdapter("queue-name")
```

### Prisma Adapter

```typescript
import { PrismaClient } from "@prisma/client"
import { PrismaQueueAdapter } from "@your-org/queue/adapters/prisma"

const prisma = new PrismaClient()
const adapter = new PrismaQueueAdapter(prisma, "queue-name")
```

### Drizzle Adapter

```typescript
import { DrizzleQueueAdapter } from "@your-org/queue/adapters/drizzle"

import { db, queueJobTable } from "./db"

const adapter = new DrizzleQueueAdapter(db, queueJobTable, "queue-name")
```

## Database Schema

For database adapters, you'll need a table with this structure:

```sql
CREATE TABLE queue_jobs (
  id VARCHAR PRIMARY KEY,
  queue_name VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  payload TEXT NOT NULL,
  status VARCHAR NOT NULL,
  priority VARCHAR NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  process_at TIMESTAMP NOT NULL,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  error TEXT
);
```

## API Reference

### Queue Configuration

```typescript
interface QueueConfig {
  name: string
  concurrency?: number // Default: 1
  defaultJobOptions?: JobOptions
  retryDelay?: number // Default: 1000ms
  maxRetryDelay?: number // Default: 30000ms
  removeOnComplete?: number // Default: 100
  removeOnFail?: number // Default: 50
}
```

### Job Options

```typescript
interface JobOptions {
  priority?: "low" | "normal" | "high" | "critical" // Default: 'normal'
  delay?: number // Delay in milliseconds
  maxAttempts?: number // Default: 3
  timeout?: number // Default: 30000ms
}
```

### Events

```typescript
queue.on("job:added", (job) => {})
queue.on("job:processing", (job) => {})
queue.on("job:completed", (job) => {})
queue.on("job:failed", (job) => {})
queue.on("job:retried", (job) => {})
queue.on("queue:paused", () => {})
queue.on("queue:resumed", () => {})
queue.on("queue:stopped", () => {})
```

## Creating Custom Adapters

Extend `BaseQueueAdapter` to create adapters for other ORMs:

```typescript
import { BaseQueueAdapter } from "@your-org/queue"

export class MyCustomAdapter extends BaseQueueAdapter {
  async connect(): Promise<void> {
    // Connection logic
  }

  async addJob<T>(job: Omit<BaseJob<T>, "id" | "createdAt">): Promise<BaseJob<T>> {
    // Add job to database
  }

  // Implement other required methods...
}
```
