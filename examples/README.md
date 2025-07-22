# Examples

Standalone examples demonstrating different configurations of vorsteh-queue.

## Available Examples

### [drizzle-pg](./drizzle-pg/)

Basic usage with Drizzle ORM and node-postgres driver.

- Simple job processing
- Priority handling
- Delayed jobs

### [drizzle-pglite](./drizzle-pglite/)

Zero-setup example using Drizzle ORM with PGlite (embedded PostgreSQL).

- No external database required
- Multiple job types with results
- Progress tracking
- Event system

### [drizzle-postgres](./drizzle-postgres/)

Advanced usage with Drizzle ORM and postgres.js driver.

- Multiple job types
- Recurring jobs
- Event handling
- Queue monitoring

### [event-system](./event-system/)

Comprehensive event monitoring and statistics.

- Job lifecycle events
- Real-time statistics
- Performance monitoring
- Error tracking

### [pm2-workers](./pm2-workers/)

Production deployment with PM2 process manager.

- Multiple worker processes
- Process management
- Scaling configuration
- Production monitoring

### [prisma-client](./prisma-client/)

Prisma ORM with PostgreSQL using driver adapters.

- Type-safe database operations
- Modern Prisma client w/o rust engine
- Job management

### [prisma-client-js](./prisma-client-js/)

Prisma ORM with traditional prisma-client-js provider.

- Legacy Prisma setup
- PostgreSQL integration
- Job management

### [progress-tracking](./progress-tracking/)

Real-time job progress tracking demonstration.

- Progress updates
- Long-running jobs
- Progress monitoring
- Status reporting

### [result-storage](./result-storage/)

Job result storage and retrieval with progress tracking.

- Job return values
- Result persistence
- Progress tracking
- Error handling

## Quick Start

1. Choose an example directory
2. Follow the README instructions in that directory
3. Ensure PostgreSQL is running locally or update the DATABASE_URL

Each example is self-contained and can be used as a starting point for your own implementation.
