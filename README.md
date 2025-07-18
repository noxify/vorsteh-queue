<div align="center">
  <img src="./assets/vorsteh-queue-logo-nobg.png" alt="Vorsteh Queue" width="200" height="200" />
  <h1>Vorsteh Queue</h1>
  <p>A TypeScript-first job queue system with multiple database adapters, built for reliability and developer experience.</p>
</div>

## Features

- **Type-safe**: Full TypeScript support with generic job payloads
- **Multiple adapters**: Drizzle ORM and in-memory implementations (Prisma coming soon)
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
│   ├── adapter-drizzle/     # Drizzle ORM adapter
│   └── adapter-prisma/      # Prisma adapter (coming soon)
├── examples/                # Standalone usage examples
│   ├── drizzle-pg/         # Drizzle + node-postgres
│   ├── drizzle-postgres/   # Drizzle + postgres.js
│   ├── progress-tracking/  # Real-time progress updates
│   ├── event-system/       # Comprehensive event monitoring
│   └── pm2-workers/        # Production deployment with PM2
└── tooling/                # Shared development tools
```

## Quick Start

### Installation

```bash
npm install @vorsteh-queue/core @vorsteh-queue/adapter-drizzle
# or
pnpm add @vorsteh-queue/core @vorsteh-queue/adapter-drizzle
```

### Basic Usage

```typescript
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { DrizzleQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

// Setup database and queue
const pool = new Pool({ connectionString: "postgresql://..." })
const db = drizzle(pool)
const adapter = new DrizzleQueueAdapter(db, "my-queue")
const queue = new Queue(adapter, { name: "my-queue" })

// Register job handlers
queue.register("send-email", async (payload: { to: string; subject: string }) => {
  // Send email logic
  return { sent: true }
})

// Add jobs
await queue.add("send-email", { to: "user@example.com", subject: "Welcome!" })
await queue.add("send-email", { to: "admin@example.com", subject: "Report" }, {
  priority: 1,    // Higher priority
  delay: 5000     // Delay 5 seconds
})

// Start processing
queue.start()
```

## Examples

Check out the [examples directory](./examples/) for complete, runnable examples:

- **[drizzle-pg](./examples/drizzle-pg/)**: Basic usage with Drizzle + node-postgres
- **[drizzle-postgres](./examples/drizzle-postgres/)**: Advanced features with Drizzle + postgres.js
- **[progress-tracking](./examples/progress-tracking/)**: Real-time job progress updates
- **[event-system](./examples/event-system/)**: Comprehensive event monitoring and statistics
- **[pm2-workers](./examples/pm2-workers/)**: Production deployment with PM2 process manager

> **Note**: All examples demonstrate the UTC-first timezone approach and automatic job cleanup features.

## Priority System

Jobs are processed by priority (lower number = higher priority):

```typescript
await queue.add("urgent-task", payload, { priority: 1 })    // Processed first
await queue.add("normal-task", payload, { priority: 2 })    // Default priority
await queue.add("low-task", payload, { priority: 3 })       // Processed last
```

## Recurring Jobs

```typescript
// Cron expression
await queue.add("daily-report", payload, {
  cron: "0 9 * * *"  // Every day at 9 AM
})

// Interval with limit
await queue.add("health-check", payload, {
  repeat: { every: 30000, limit: 10 }  // Every 30s, 10 times
})
```

## Job Cleanup

```typescript
// Automatic cleanup configuration
const queue = new Queue(adapter, {
  name: "my-queue",
  removeOnComplete: true,  // Remove completed jobs immediately
  removeOnFail: false,     // Keep failed jobs for debugging
  // Or use numbers to keep N jobs
  removeOnComplete: 100,   // Keep last 100 completed jobs
  removeOnFail: 50,        // Keep last 50 failed jobs
})
```

## Timezone Support

Vorsteh Queue uses a **UTC-first approach** for reliable timezone handling:

```typescript
// Schedule job for 9 AM New York time - converted to UTC immediately
await queue.add("daily-report", payload, {
  cron: "0 9 * * *",
  timezone: "America/New_York"  // Timezone used for conversion only
})

// Schedule job for specific time in Tokyo - stored as UTC
await queue.add("notification", payload, {
  runAt: new Date("2024-01-15T10:00:00"),
  timezone: "Asia/Tokyo"  // Interprets runAt in Tokyo time
})

// Complex cron with timezone - result always UTC
await queue.add("business-task", payload, {
  cron: "*/15 9-17 * * 1-5",
  timezone: "Europe/London"  // Business hours in London time
})
```

### How It Works

1. **Timezone conversion happens at job creation** - not at execution
2. **All timestamps stored in database are UTC** - no timezone ambiguity
3. **Recurring jobs recalculate using original timezone** - maintains accuracy
4. **Simple and predictable** - no runtime timezone complexity
5. **Server timezone independent** - works consistently across environments

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

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build packages
pnpm build
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details.
