# Drizzle + postgres.js Example

Minimal example showing how to use vorsteh-queue with Drizzle ORM and postgres.js.

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

- Job registration with different priorities
- Recurring jobs with limits
- Event listeners for job lifecycle
- Queue statistics monitoring
- Graceful shutdown with cleanup