# TUI Dashboard — Direct Mode

Interactive TUI dashboard example using the direct adapter transport (no GraphQL server needed).

## Quick Start (All-in-One)

This mode runs workers and the TUI dashboard in a single process using in-memory PGlite:

```bash
pnpm install
pnpm dev    # Starts workers + seeds + dashboard (all-in-one)
```

> **Note:** The `ink` and `react` dependencies are only needed for this all-in-one demo where the dashboard is embedded in the same process.

## Multi-Process Setup (PGlite Socket Server)

For a more realistic setup, workers and the dashboard run as separate processes. A PGlite socket server provides multi-process access to the same database.

**Terminal 1 — Workers + Socket Server:**

```bash
pnpm dev:prod    # Starts PGlite socket server (port 5488) + workers + seed
```

**Terminal 2 — Dashboard:**

```bash
pnpm dashboard                  # Default queue (email)
pnpm dashboard:email            # Email queue
pnpm dashboard:data             # Data-processing queue
pnpm dashboard:notifications    # Notifications queue
pnpm dashboard:deployments      # Deployments queue
```

The dashboard reads `queue.config.ts` which connects to the PGlite socket server via `node-postgres`.

### Architecture

```
┌─────────────┐     PostgreSQL      ┌─────────────────────────┐
│  Dashboard  │     Protocol        │  Worker Process         │
│  (TUI CLI)  │ ◀──────────────────▶│  (PGlite Socket Server) │
└─────────────┘     port 5488       │  + Seed + Workers       │
                                    └─────────────────────────┘
```

### queue.config.ts

The dashboard CLI uses `queue.config.ts` to connect to the PGlite socket server:

```typescript
import { PostgresQueueAdapter } from "@vorsteh-queue/adapter-drizzle"
import { drizzle } from "drizzle-orm/node-postgres"

const db = drizzle({
  connection: "postgresql://postgres:postgres@127.0.0.1:5488/postgres",
})

const adapter = new PostgresQueueAdapter(db)

export default {
  adapter,
  queues: [emailQueue, dataQueue, notificationQueue, deploymentQueue],
  defaultQueue: "email",
}
```

## Files

| File                | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `src/index.ts`      | All-in-one demo (PGlite in-memory, single process)     |
| `src/index-prod.ts` | Socket server + workers (multi-process setup)          |
| `src/database.ts`   | PGlite instance + socket server setup                  |
| `src/queues.ts`     | Queue definitions (email, data, notifications, deploy) |
| `src/workers.ts`    | Worker handlers with diverse job types                 |
| `src/seed.ts`       | Seed data (flows, cron, delayed, grouped jobs)         |
| `queue.config.ts`   | CLI config connecting via node-postgres                |

## Environment Variables

| Variable      | Default | Description                       |
| ------------- | ------- | --------------------------------- |
| `PGLITE_PORT` | `5488`  | Port for the PGlite socket server |

## Documentation

- [TUI Dashboard Guide](https://vorsteh-queue.dev/docs/examples/advanced/tui-dashboard)
- [CLI Overview](https://vorsteh-queue.dev/docs/cli/overview/installation)
- [Flow Trees](https://vorsteh-queue.dev/docs/vorsteh-queue/core/flows/flow-trees)
- [Drizzle Adapter](https://vorsteh-queue.dev/docs/vorsteh-queue/adapters/drizzle)
