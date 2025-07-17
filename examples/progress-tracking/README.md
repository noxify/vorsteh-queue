# Progress Tracking Example

This example demonstrates real-time job progress tracking with Vorsteh Queue.

## Features Demonstrated

- **Real-time progress updates** - Jobs report progress as they execute
- **Multiple progress scenarios** - Dataset processing and file uploads
- **Progress event listening** - Monitor progress updates in real-time
- **Realistic simulations** - Chunked processing and upload scenarios

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
1. Process a dataset with 5 items, showing progress updates
2. Simulate file uploads with chunked progress tracking
3. Display real-time progress percentages
4. Show completion notifications

Perfect for understanding how to implement progress bars, upload indicators, or processing status in your applications.