---
"@vorsteh-queue/server": minor
"@vorsteh-queue/core": minor
---

Integrated web dashboard into the server package and added unified configuration.

**Server (`@vorsteh-queue/server`):**

- Embedded the dashboard UI — served as static assets via Hono when `dashboard: true` (default)
- Simplified auth: `tokens: string[]`, custom `middleware`, or `false` (removed basic auth)
- Added `loadConfig()` to load `queue.config.ts` via c12
- Restructured: `src/api/` (GraphQL schema, auth, pubsub) + `src/ui/` (React SPA)
- Added `flows` query and implemented the `jobs` query (was a stub)
- Dashboard communicates with the API via `gql.tada` + `graphql-request`
- UI: Overview stats, Jobs list (filtered/paginated), Job detail, DLQ, Flows, Flow DAG visualization

**Core (`@vorsteh-queue/core`):**

- Added `getJobs()` and `getFlows()` to `QueueAdapter` interface
- Implemented in Memory, Drizzle, Kysely, and Prisma adapters
