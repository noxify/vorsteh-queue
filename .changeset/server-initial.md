---
"@vorsteh-queue/server": minor
---

## @vorsteh-queue/server — Initial Release

GraphQL server and monitoring API for vorsteh-queue.

- `createQueueServer(config)` — standalone server (Hono + Node.js)
- `createQueueMiddleware(config)` — composable Hono middleware
- GraphQL API (via GraphQL Yoga + Pothos):
  - Queries: `stats`, `job`, `deadJobs`, `size`
  - Mutations: `cancelJob`, `redriveJob`, `redriveAll`, `clearJobs`
  - Subscriptions: `jobStatusChanged`, `statsUpdated` (SSE-based)
- Authentication: token (Bearer), basic auth, custom middleware, or disabled
- PubSub for real-time event streaming to GraphQL subscribers
- `defineConfig()` helper for typed configuration
