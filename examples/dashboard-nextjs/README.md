# Next.js Dashboard Example

A full-featured queue monitoring dashboard built with Next.js, demonstrating both direct adapter access and remote API modes.

## Quick Start

```bash
pnpm install

# Terminal 1: Start PGlite socket server + workers + seed data
pnpm dev:queue

# Terminal 2: Start the Next.js dashboard
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

## Architecture

```
┌─────────────────┐     PostgreSQL      ┌─────────────────────────┐
│  Next.js        │     Protocol        │  Worker Process         │
│  (Dashboard UI) │ ◀──────────────────▶│  (PGlite Socket Server) │
│  localhost:3000  │     port 5488       │  + Seed + Workers       │
└─────────────────┘                     └─────────────────────────┘
```

The worker process (`pnpm dev:queue`) starts a PGlite instance with a socket server. Next.js connects to it via standard `node-postgres` — same as connecting to a real PostgreSQL database.

## Modes

### Direct Mode (default)

Reads `queue.config.ts` via c12 and talks to the adapter directly. Best for local development and single-deployment setups.

```env
QUEUE_MODE=direct
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5488/postgres
```

### API Mode

Connects to a remote GraphQL server (e.g. `@vorsteh-queue/server`). Best for production where the dashboard and workers run on separate machines.

```env
QUEUE_MODE=api
QUEUE_API_URL=http://localhost:4000/graphql
QUEUE_API_TOKEN=your-token-here
```

## Features

- **Server-side rendering** with TanStack Query prefetching (no loading spinners)
- **Client-side polling** with configurable refresh intervals (5s stats, 10s jobs)
- **Type-safe URL state** via nuqs (filters, pagination)
- **Type-safe environment** via t3-env with Zod validation
- **shadcn/ui components** (Sidebar, Card, Table, Badge, Select, Button)
- **Queue client abstraction** — swap between direct/API mode via env var
- **PGlite socket server** — zero-setup local PostgreSQL via `@electric-sql/pglite-socket`

## Pages

| Route         | Description                                |
| ------------- | ------------------------------------------ |
| `/`           | Overview with stat cards (auto-refresh 5s) |
| `/jobs`       | Filterable, paginated job table            |
| `/jobs/[id]`  | Job detail with payload, error, result     |
| `/dlq`        | Dead letter queue with redrive actions     |
| `/flows`      | Flow card grid                             |
| `/flows/[id]` | Flow tree visualization                    |

## Scripts

| Script           | Description                                 |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Start Next.js dev server                    |
| `pnpm dev:queue` | Start PGlite socket server + workers + seed |
| `pnpm build`     | Build for production                        |
| `pnpm start`     | Start production server                     |
| `pnpm clean`     | Delete PGlite data directory                |

## Stack

- Next.js 16 (App Router, Server Components, Server Actions)
- TanStack Query (prefetch + client polling)
- nuqs (type-safe URL search params)
- t3-env (type-safe environment variables)
- shadcn/ui (base-nova style with @base-ui/react)
- PGlite + pglite-socket (zero-setup PostgreSQL)
- Drizzle ORM

## Documentation

- [Dashboard Example Guide](https://vorsteh-queue.dev/docs/examples/advanced/dashboard-nextjs)
- [Drizzle Adapter](https://vorsteh-queue.dev/docs/vorsteh-queue/adapters/drizzle)
- [Flow Trees](https://vorsteh-queue.dev/docs/vorsteh-queue/core/flows/flow-trees)
