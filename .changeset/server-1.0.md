---
"@vorsteh-queue/server": major
---

## @vorsteh-queue/server 1.0 — Initial Release

GraphQL server, web dashboard, and monitoring API for Vorsteh Queue.

### GraphQL API

- `createQueueServer(config)` — standalone server (Hono + Node.js)
- `createQueueMiddleware(config)` — composable Hono middleware for existing apps
- Queries: `stats`, `job`, `jobs` (with `where: JobWhereInput`), `deadJobs`, `size`, `flows`
- Mutations: `cancelJob`, `redriveJob`, `redriveAll`, `retryJob`, `runJobNow`, `deleteJob`, `clearJobs`
- Subscriptions: `jobStatusChanged`, `statsUpdated` (SSE-based)
- PubSub for real-time event streaming

### Web Dashboard

- Embedded dashboard served as static assets when `dashboard: true` (default)
- Overview stats, Jobs list (filtered/paginated), Job detail, DLQ, Flows, Flow DAG visualization
- Communicates with the API via `gql.tada` + `graphql-request`

### Authentication

- Token-based auth: `tokens: string[]`
- Custom middleware support for advanced auth scenarios
- Disable with `false` for development

### Configuration

- `loadConfig()` to load `queue.config.ts` via c12
- `defineConfig()` helper for typed configuration
