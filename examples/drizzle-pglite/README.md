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

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the example
pnpm dev
```

## What It Does

1. **Creates embedded database** - PGlite starts with empty database
2. **Sets up schema** - Creates queue tables automatically
3. **Registers job handlers** - Email and data processing jobs
4. **Adds various jobs** - Immediate, delayed, priority, and recurring
5. **Processes jobs** - Shows real-time progress and events
6. **Displays stats** - Queue statistics every 5 seconds
7. **Graceful shutdown** - Stops after 30 seconds

## Perfect for Bug Reports

This example is ideal for reproducing bugs because:

- **Zero setup** - No PostgreSQL installation needed
- **Self-contained** - Everything in one file
- **Fast startup** - PGlite initializes instantly
- **Comprehensive** - Covers all major features
- **Portable** - Runs anywhere Node.js works

## Example Output

```
🚀 Starting PGlite Queue Example

📝 Adding jobs to queue...
✅ Job added: send-email (abc123...)
✅ Job added: send-email (def456...)
✅ Job added: process-data (ghi789...)

🔄 Starting queue processing...
⚡ Processing: send-email (abc123...)
📧 Sending email to user@example.com
   Subject: Welcome to Vorsteh Queue!
🎉 Completed: send-email (abc123...)

📊 Queue Stats: { pending: 2, processing: 0, completed: 1, failed: 0, delayed: 1 }
```

## Job Types

### Email Job
```typescript
interface EmailJob {
  to: string
  subject: string  
  body: string
}
```

### Data Processing Job
```typescript
interface DataProcessingJob {
  items: string[]
  batchSize: number
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