# Drizzle + PGlite Example

A complete example using Vorsteh Queue with Drizzle ORM and PGlite (embedded PostgreSQL).

## Features Demonstrated

- ✅ **Embedded PostgreSQL** - No database setup required
- ✅ **Multiple job types** - Email and data processing jobs
- ✅ **Progress tracking** - Real-time job progress updates
- ✅ **Event system** - Listen to job lifecycle events
- ✅ **Priority queues** - High priority jobs processed first
- ✅ **Delayed jobs** - Schedule jobs for future execution
- ✅ **Recurring jobs** - Repeat jobs with intervals and limits
- ✅ **Queue statistics** - Monitor queue health
- ✅ **Graceful shutdown** - Clean termination

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Push database schema:

```bash
pnpm db:push
```

3. Run the example:

```bash
pnpm dev
```

> **Note**: PGlite creates an embedded PostgreSQL database automatically, but the schema still needs to be initialized.

## What It Does

1. **Creates embedded database** - PGlite starts with empty database
2. **Initializes schema** - Uses drizzle-kit pushSchema to create tables
3. **Registers job handlers** - Email and data processing jobs with TypeScript types
4. **Adds sample jobs** - Immediate, delayed, and priority jobs
5. **Processes jobs** - Shows real-time progress and events
6. **Displays stats** - Queue statistics every 10 seconds
7. **Graceful shutdown** - Press Ctrl+C to stop cleanly

## Perfect for Bug Reports

This example is ideal for reproducing bugs because:

- **Zero setup** - No PostgreSQL installation needed
- **Self-contained** - Everything in one file
- **Fast startup** - PGlite initializes instantly
- **Comprehensive** - Covers all major features
- **Portable** - Runs anywhere Node.js works

## Example Output

```
🚀 Starting PGlite Queue Example (Embedded PostgreSQL)
📋 Initializing database schema...
✅ Database schema initialized
✅ Job added: send-email (abc123...)
✅ Job added: process-data (def456...)
✅ Job added: send-email (ghi789...)
🔄 Queue processing started. Press Ctrl+C to stop.
⚡ Processing: send-email (abc123...)
📧 Sending email to user@example.com: Welcome!
🎉 Completed: send-email (abc123...)
⚡ Processing: process-data (def456...)
📊 Processing 20 items in batches of 5
📈 Progress: process-data - 25%
📈 Progress: process-data - 50%
📊 Queue Stats: { pending: 1, processing: 1, completed: 1, failed: 0, delayed: 1 }
```

## Job Types

### Email Job

```typescript
interface EmailJob {
  to: string
  subject: string
  body?: string
}

interface EmailResult {
  sent: boolean
  messageId: string
}
```

### Data Processing Job

```typescript
interface DataProcessingJob {
  data: unknown[]
  batchSize?: number
}

interface DataProcessingResult {
  processed: number
  results: unknown[]
}
```

## Key Features

- **Type-safe payloads** - Full TypeScript support
- **Progress updates** - Real-time progress tracking
- **Event listeners** - Monitor all job lifecycle events
- **Queue management** - Automatic cleanup of old jobs
- **Error handling** - Proper error reporting and retry logic

## Use Cases

- **Bug reproduction** - Minimal setup for issue reports
- **Feature testing** - Quick way to test new features
- **Learning** - Understand how Vorsteh Queue works
- **Prototyping** - Rapid development without database setup
