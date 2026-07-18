# @vorsteh-queue/query-builder

Query builder and filter utilities for Vorsteh Queue. Normalizes, matches, and translates `JobWhereInput` filters for all supported ORMs.

## Installation

```bash
pnpm add @vorsteh-queue/query-builder
```

## Entrypoints

| Entrypoint | Description |
| --- | --- |
| `@vorsteh-queue/query-builder` | Core types, `normalizeWhere()`, `matchesWhere()` |
| `@vorsteh-queue/query-builder/drizzle` | `buildWhere()` for Drizzle ORM |
| `@vorsteh-queue/query-builder/kysely` | `buildWhere()` for Kysely |
| `@vorsteh-queue/query-builder/prisma` | `buildWhere()` for Prisma |

## Types

### `JobWhereInput`

The primary filter input type. Supports scalar shorthands for ergonomic usage:

```typescript
import type { JobWhereInput } from "@vorsteh-queue/query-builder"

// Shorthand — string value equals { eq: value }
const where: JobWhereInput = { status: "pending", name: "send-email" }

// Full form
const where: JobWhereInput = {
  status: { eq: "pending" },
  name: { contains: "email" },
  createdAt: { gte: "2024-01-01T00:00:00Z" },
}
```

### `NormalizedJobWhereInput`

The normalized form produced by `normalizeWhere()`. All shorthands are expanded to full filter objects.

### Filter Types

| Type | Operators | Used For |
| --- | --- | --- |
| `StringFilter` | `eq`, `neq`, `contains`, `startsWith`, `like`, `in`, `isNull` | `id`, `name`, `uniqueKey`, `groupKey`, `flowId`, `parentId` |
| `IntFilter` | `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `isNull` | `priority`, `attempts`, `progress`, `repeatCount` |
| `DateTimeFilter` | `lt`, `lte`, `gt`, `gte`, `isNull` | `createdAt`, `processAt`, `processedAt`, `completedAt`, `failedAt`, `cancelledAt` |
| `JobStatusFilter` | `eq`, `neq`, `in` | `status` |
| `NullFilter` | `isNull` | `cron`, `timeout` |

## Functions

### `normalizeWhere(where?)`

Expands scalar shorthands to full filter objects. Recursively normalizes `AND`/`OR` arrays.

```typescript
import { normalizeWhere } from "@vorsteh-queue/query-builder"

const normalized = normalizeWhere({ status: "pending", name: "send-email" })
// → { status: { eq: "pending" }, name: { eq: "send-email" } }
```

### `matchesWhere(job, where)`

In-memory filter matching. Tests whether a job record satisfies a normalized where filter. Supports all operators and recursive AND/OR.

```typescript
import { matchesWhere, normalizeWhere } from "@vorsteh-queue/query-builder"

const where = normalizeWhere({ status: "failed", priority: { lte: 2 } })
const matches = matchesWhere(job, where)
```

### `buildWhere()` (Drizzle)

Translates a normalized filter to Drizzle SQL conditions.

```typescript
import { buildWhere } from "@vorsteh-queue/query-builder/drizzle"
import { normalizeWhere } from "@vorsteh-queue/query-builder"

const normalized = normalizeWhere(options.where)
const whereClause = buildWhere(normalized, table)

const jobs = await db.select().from(table).where(whereClause)
```

### `buildWhere()` (Kysely)

Applies filter conditions to a Kysely query builder.

```typescript
import { buildWhere } from "@vorsteh-queue/query-builder/kysely"
import { normalizeWhere } from "@vorsteh-queue/query-builder"

const normalized = normalizeWhere(options.where)
let qb = db.selectFrom("queue_jobs")
qb = buildWhere(qb, normalized)

const jobs = await qb.selectAll().execute()
```

### `buildWhere()` (Prisma)

Translates a normalized filter to a Prisma where object.

```typescript
import { buildWhere } from "@vorsteh-queue/query-builder/prisma"
import { normalizeWhere } from "@vorsteh-queue/query-builder"

const normalized = normalizeWhere(options.where)
const prismaWhere = buildWhere(normalized)

const jobs = await prisma.queueJob.findMany({ where: prismaWhere })
```

## Common Usage Patterns

### Filter by status

```typescript
const where: JobWhereInput = { status: "failed" }
```

### Filter by name pattern

```typescript
const where: JobWhereInput = { name: { contains: "email" } }
```

### Filter by time range (last 24 hours)

```typescript
const where: JobWhereInput = {
  createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
}
```

### Combine with AND/OR

```typescript
const where: JobWhereInput = {
  status: { in: ["failed", "dead"] },
  OR: [{ name: { contains: "email" } }, { name: { contains: "sms" } }],
}
```

### Filter root jobs (no parent)

```typescript
const where: JobWhereInput = { parentId: { isNull: true } }
```

## Peer Dependencies

ORM-specific entrypoints require the corresponding peer dependency:

- `./drizzle` → `drizzle-orm >= 0.45`
- `./kysely` → `kysely >= 0.27`
- `./prisma` → `@prisma/client >= 5`
