<!-- test -->
<div align="center">
  <img src="./assets/vorsteh-queue-logo-nobg.png" alt="Vorsteh Queue" height="200" />
  <h1>Vorsteh Queue</h1>
  <p>A powerful, ORM-agnostic queue engine for PostgreSQL 12+. Handle background jobs, scheduled tasks, and recurring processes with ease.</p>
</div>

## Features

- **Type-safe**: Full TypeScript support with generic job payloads
- **Multiple adapters**: Drizzle ORM (PostgreSQL), Prisma ORM (PostgreSQL), and in-memory implementations
- **Priority queues**: Numeric priority system (lower = higher priority)
- **Delayed jobs**: Schedule jobs for future execution
- **Recurring jobs**: Cron expressions and interval-based repetition
- **UTC-first timezone support**: Reliable timezone handling with UTC storage
- **Progress tracking**: Real-time job progress updates
- **Event system**: Listen to job lifecycle events
- **Graceful shutdown**: Clean job processing termination

## Repository Structure

```
.
├── packages/
│   ├── core/                # Core queue logic and interfaces
│   ├── adapter-drizzle/     # Drizzle ORM adapter (PostgreSQL)
│   └── adapter-prisma/      # Prisma ORM adapter (PostgreSQL)
├── examples/                # Standalone usage examples
└── tooling/                # Shared development tools
```

## Quick Start

### Requirements

- **Node.js 20+**
- **ESM only** - This package is ESM-only and cannot be imported with `require()`

### Installation

```bash
npm install @vorsteh-queue/core @vorsteh-queue/adapter-drizzle
# or
pnpm add @vorsteh-queue/core @vorsteh-queue/adapter-drizzle
```

> **Note**: Make sure your project has `"type": "module"` in package.json or use `.mjs` file extensions.

### Basic Usage

```typescript
// Drizzle ORM with PostgreSQL
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

interface EmailPayload {
  to: string
  subject: string
  body: string
}

interface EmailResult {
  messageId: string
  sent: boolean
}

const pool = new Pool({ connectionString: "postgresql://..." })
const db = drizzle(pool)
const queue = new Queue(new PostgresQueueAdapter(db), { name: "my-queue" })

// Prisma ORM with PostgreSQL
import { PrismaClient } from "@prisma/client"
import { PostgresPrismaQueueAdapter } from "@vorsteh-queue/adapter-prisma"

const prisma = new PrismaClient()
const queue = new Queue(new PostgresPrismaQueueAdapter(prisma), { name: "my-queue" })

// Register job handlers
queue.register<EmailPayload, EmailResult>("send-email", async (job) => {
  console.log(`Sending email to ${job.payload.to}`)

  // Send email logic here
  await sendEmail(job.payload)

  // Return result - will be stored in job.result field
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
await queue.add(
  "send-email",
  { to: "admin@example.com", subject: "Report" },
  {
    priority: 1, // Higher priority
    delay: 5000, // Delay 5 seconds
  },
)

// Start processing
queue.start()
```

## Examples

Check out the [examples directory](./examples/) for complete, runnable examples.

> **Note**: All examples demonstrate the UTC-first timezone approach and automatic job cleanup features.

## Priority System

Jobs are processed by priority (lower number = higher priority):

```typescript
await queue.add("urgent-task", payload, { priority: 1 }) // Processed first
await queue.add("normal-task", payload, { priority: 2 }) // Default priority
await queue.add("low-task", payload, { priority: 3 }) // Processed last
```

## Recurring Jobs

```typescript
// Cron expression
await queue.add("daily-report", payload, {
  cron: "0 9 * * *", // Every day at 9 AM
})

// Interval with limit
await queue.add("health-check", payload, {
  repeat: { every: 30000, limit: 10 }, // Every 30s, 10 times
})
```

## Job Cleanup

```typescript
// Automatic cleanup configuration
const queue = new Queue(adapter, {
  name: "my-queue",
  removeOnComplete: true, // Remove completed jobs immediately
  removeOnFail: false, // Keep failed jobs for debugging
  // Or use numbers to keep N jobs
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 50, // Keep last 50 failed jobs
})
```

## Timezone Support

Vorsteh Queue uses a **UTC-first approach** for reliable timezone handling:

```typescript
// Schedule job for 9 AM New York time - converted to UTC immediately
await queue.add("daily-report", payload, {
  cron: "0 9 * * *",
  timezone: "America/New_York", // Timezone used for conversion only
})

// Schedule job for specific time in Tokyo - stored as UTC
await queue.add("notification", payload, {
  runAt: new Date("2024-01-15T10:00:00"),
  timezone: "Asia/Tokyo", // Interprets runAt in Tokyo time
})

// Complex cron with timezone - result always UTC
await queue.add("business-task", payload, {
  cron: "*/15 9-17 * * 1-5",
  timezone: "Europe/London", // Business hours in London time
})
```

### How It Works

1. **Timezone conversion happens at job creation** - not at execution
2. **All timestamps stored in database are UTC** - no timezone ambiguity
3. **Recurring jobs recalculate using original timezone** - maintains accuracy
4. **Simple and predictable** - no runtime timezone complexity
5. **Server timezone independent** - works consistently across environments

## Job Results

Job handlers can return results that are automatically stored and made available:

```typescript
interface ProcessResult {
  processed: number
  errors: string[]
  duration: number
}

queue.register<{ items: string[] }, ProcessResult>("process-data", async (job) => {
  const startTime = Date.now()
  const errors: string[] = []
  let processed = 0

  for (const item of job.payload.items) {
    try {
      await processItem(item)
      processed++
    } catch (error) {
      errors.push(`Failed to process ${item}: ${error.message}`)
    }
  }

  // Return result - automatically stored in job.result field
  return {
    processed,
    errors,
    duration: Date.now() - startTime,
  }
})

// Access results in events
queue.on("job:completed", (job) => {
  const result = job.result as ProcessResult
  console.log(`Processed ${result.processed} items in ${result.duration}ms`)
  if (result.errors.length > 0) {
    console.warn(`Errors: ${result.errors.join(", ")}`)
  }
})
```

## Progress Tracking

```typescript
// Register a job that reports progress
queue.register("process-data", async (job) => {
  const items = job.payload.items

  for (let i = 0; i < items.length; i++) {
    // Process item
    await processItem(items[i])

    // Update progress (0-100)
    const progress = Math.round(((i + 1) / items.length) * 100)
    await job.updateProgress(progress)
  }

  return { processed: items.length }
})

// Listen to progress updates
queue.on("job:progress", (job) => {
  console.log(`Job ${job.name}: ${job.progress}% complete`)
})
```

## Event System

```typescript
// Listen to all job lifecycle events
queue.on("job:added", (job) => {
  console.log(`✅ Job ${job.name} added to queue`)
})

queue.on("job:processing", (job) => {
  console.log(`⚡ Job ${job.name} started processing`)
})

queue.on("job:completed", (job) => {
  console.log(`🎉 Job ${job.name} completed successfully`)
  console.log(`📊 Result:`, job.result) // Access job result
})

queue.on("job:failed", (job) => {
  console.error(`❌ Job ${job.name} failed: ${job.error}`)
})

queue.on("job:retried", (job) => {
  console.log(`🔄 Job ${job.name} retrying (attempt ${job.attempts})`)
})

// Queue-level events
queue.on("queue:paused", () => {
  console.log("⏸️ Queue paused")
})

queue.on("queue:resumed", () => {
  console.log("▶️ Queue resumed")
})
```

## Architecture

### UTC-First Design

- **Database storage**: All timestamps stored as UTC
- **Timezone conversion**: Happens at job creation time
- **No timezone fields**: Database schema contains no timezone columns
- **Predictable behavior**: Same results across different server timezones

### Adapter Pattern

- **Pluggable storage**: Easy to add new database adapters
- **Consistent interface**: Same API across all adapters
- **Type safety**: Full TypeScript support throughout

## Development

This project was developed with AI assistance, combining human expertise with AI-powered code generation to accelerate development while maintaining high code quality standards.

```bash
# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run specific test suites
pnpm test:core                # Core package tests
pnpm test:drizzle-postgres    # PostgreSQL adapter tests
pnpm test:drizzle-mariadb     # MariaDB adapter tests

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build packages
pnpm build
```

## Contributing

Contributions are welcome! Please read our [contributing guidelines](./CONTRIBUTING.md) and submit pull requests to our repository.

## License

MIT License - see [LICENSE](./LICENSE) file for details.
