# Event System Example

This example demonstrates comprehensive event monitoring and queue management with Vorsteh Queue.

## Features Demonstrated

- **Complete event lifecycle** - From job creation to completion/failure
- **Job statistics tracking** - Real-time counters for all job states
- **Error handling and retries** - Automatic retry logic with event monitoring
- **Queue control** - Pause/resume functionality with events
- **Comprehensive logging** - Timestamped event logs with detailed information

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up PostgreSQL database and update connection string in `src/index.ts` or set `DATABASE_URL` environment variable.

3. Push database schema:
```bash
pnpm db:push
```

## Running

```bash
pnpm dev
```

## What You'll See

The example will:
1. Add various job types (reliable, unreliable, slow)
2. Show detailed event logs for each job lifecycle stage
3. Demonstrate retry behavior for failed jobs
4. Display periodic statistics summaries
5. Show queue pause/resume functionality
6. Provide final statistics on shutdown

Perfect for building monitoring dashboards, logging systems, or understanding queue behavior in production environments.