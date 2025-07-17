# Drizzle + node-postgres Example

Minimal example showing how to use vorsteh-queue with Drizzle ORM and node-postgres.

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up PostgreSQL database and copy environment variables:
```bash
cp .env.example .env
# Edit .env with your database URL
```

3. Push database schema:
```bash
pnpm db:push
```

4. Run the example:
```bash
pnpm dev
```

## Features Demonstrated

- Basic job registration and processing
- Priority-based job execution
- Delayed job scheduling
- Graceful shutdown handling