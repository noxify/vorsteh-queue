# TUI Dashboard — Direct Mode

Interactive TUI dashboard example using the direct adapter transport (no GraphQL server needed).

## Quick Start (PGlite Demo)

This example uses PGlite (in-memory PostgreSQL) for zero-setup. Since PGlite doesn't support multi-process access, workers and dashboard run in a **single process**:

```bash
pnpm install
pnpm dev    # Starts workers + seeds + dashboard (all-in-one)
```

> **Note:** The `ink` and `react` dependencies are only needed for this PGlite demo where the dashboard is embedded in the same process. They are not required in a production setup.

## Production Setup (Real Database)

With a real PostgreSQL database, workers and dashboard run as **separate processes** since they can both connect to the same database independently.

**Terminal 1 — Workers:**

```bash
tsx src/index-prod.ts
```

**Terminal 2 — Dashboard:**

```bash
vorsteh-queue dashboard                  # Uses queue.config.ts
vorsteh-queue dashboard --queue email    # Specific queue
```

In this setup you don't need `ink` or `react` as dependencies — the `vorsteh-queue` CLI provides them.

### queue.config.ts

The dashboard reads `queue.config.ts` from the project root to connect directly to the adapter:

```typescript
import { createAdapter, emailQueue, dataQueue } from "./src/queues"

export default {
  adapter: createAdapter(),
  queues: [emailQueue, dataQueue],
  defaultQueue: "email",
}
```

## Files

| File                | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `src/index.ts`      | PGlite demo (all-in-one process)                       |
| `src/index-prod.ts` | Production template (workers only, dashboard separate) |
| `queue.config.ts`   | CLI config for separate dashboard process              |

## Documentation

- [TUI Dashboard Guide](https://vorsteh-queue.dev/docs/examples/advanced/tui-dashboard)
- [CLI Overview](https://vorsteh-queue.dev/docs/cli/overview/installation)
- [Flow Trees](https://vorsteh-queue.dev/docs/vorsteh-queue/core/flows/flow-trees)
- [Drizzle Adapter](https://vorsteh-queue.dev/docs/vorsteh-queue/adapters/drizzle)
