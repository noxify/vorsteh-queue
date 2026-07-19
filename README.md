<div align="center">
  <img src="./assets/logo-color.svg" alt="Vorsteh Queue" height="200" />
  <h1>Vorsteh Queue</h1>
  <p>A type-safe PostgreSQL job queue for Node.js with durable execution, flow orchestration, and first-class ORM adapters.</p>
</div>

## Features

- **Type-safe**: Full TypeScript support with generic job payloads
- **Multiple adapters**: Drizzle ORM, Prisma ORM, Kysely, ZenStack, TypeORM (all PostgreSQL)
- **Priority queues**: Numeric priority system (lower = higher priority)
- **Delayed jobs**: Schedule jobs for future execution
- **Recurring jobs**: Cron expressions and interval-based repetition
- **Batch processing**: Process multiple jobs concurrently with grouping support
- **Flow producer**: Define parent/child job dependencies
- **UTC-first timezone support**: Reliable timezone handling with UTC storage
- **Progress tracking**: Real-time job progress updates
- **Event system**: Listen to job lifecycle events
- **Graceful shutdown**: Clean job processing termination
- **GraphQL API**: Built-in GraphQL server for queue management and monitoring

## Packages

| Package | Description |
| --- | --- |
| [`@vorsteh-queue/core`](./packages/core) | Core queue engine and interfaces |
| [`@vorsteh-queue/adapter-drizzle`](./packages/adapter-drizzle) | Drizzle ORM adapter (PostgreSQL) |
| [`@vorsteh-queue/adapter-prisma`](./packages/adapter-prisma) | Prisma ORM adapter (PostgreSQL) |
| [`@vorsteh-queue/adapter-kysely`](./packages/adapter-kysely) | Kysely adapter (PostgreSQL) |
| [`@vorsteh-queue/adapter-zenstack`](./packages/adapter-zenstack) | ZenStack ORM adapter (PostgreSQL) |
| [`@vorsteh-queue/adapter-typeorm`](./packages/adapter-typeorm) | TypeORM adapter (PostgreSQL) |
| [`@vorsteh-queue/server`](./packages/server) | GraphQL API server for queue management |
| [`create-vorsteh-queue`](./packages/create-vorsteh-queue) | CLI scaffolding tool |

## Quick Start

```bash
pnpm dlx create-vorsteh-queue my-queue-app
```

Or install manually:

```bash
pnpm add @vorsteh-queue/core @vorsteh-queue/adapter-drizzle
```

```typescript
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { Queue } from "@vorsteh-queue/core"

const pool = new Pool({ connectionString: "postgresql://..." })
const db = drizzle(pool)
const queue = new Queue(new PostgresQueueAdapter(db), { name: "my-queue" })

queue.register("send-email", async (job) => {
  await sendEmail(job.payload)
  return { sent: true }
})

await queue.add("send-email", { to: "user@example.com", subject: "Welcome!" })

queue.start()
```

## Requirements

- Node.js 22+
- PostgreSQL 12+
- ESM only (`"type": "module"` in package.json)

## Documentation

See the [Vorsteh Queue Documentation](https://vorsteh-queue.dev/docs) for detailed guides, API reference, and examples.

## Development

```bash
pnpm install        # Install dependencies
pnpm dev            # Start dev mode
pnpm build          # Build all packages
pnpm typecheck      # Type check
pnpm lint:fix       # Lint and auto-fix
pnpm format:fix     # Format code
pnpm test           # Run tests (watch)
vitest --run        # Run tests (single run)
```

## License

[MIT](./LICENSE)
