# Filtering Guide

This guide covers common filter patterns using `JobWhereInput`. All examples use the TypeScript API, but the same structure applies to GraphQL queries.

## Filter by Status

```typescript
// Single status
const where: JobWhereInput = { status: "failed" }

// Multiple statuses (OR within the field)
const where: JobWhereInput = { status: { in: ["failed", "dead"] } }

// Exclude a status
const where: JobWhereInput = { status: { neq: "completed" } }
```

## Filter by Time Range

```typescript
// Jobs created in the last hour
const where: JobWhereInput = {
  createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
}

// Jobs created between two dates
const where: JobWhereInput = {
  createdAt: {
    gte: "2024-01-01T00:00:00Z",
    lt: "2024-02-01T00:00:00Z",
  },
}

// Jobs that have not been processed yet
const where: JobWhereInput = {
  processedAt: { isNull: true },
}

// Jobs that failed in the last 24 hours
const where: JobWhereInput = {
  failedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
}

// Jobs scheduled for the future
const where: JobWhereInput = {
  processAt: { gt: new Date() },
}
```

## Filter by Name Search

```typescript
// Contains substring
const where: JobWhereInput = { name: { contains: "email" } }

// Starts with prefix
const where: JobWhereInput = { name: { startsWith: "billing:" } }

// SQL LIKE pattern (% = any chars, _ = single char)
const where: JobWhereInput = { name: { like: "send-%" } }

// Exact match (shorthand)
const where: JobWhereInput = { name: "send-email" }

// One of multiple names
const where: JobWhereInput = {
  name: { in: ["send-email", "send-sms", "send-push"] },
}
```

## Filter by Priority

```typescript
// Exact priority
const where: JobWhereInput = { priority: 1 }

// High priority (1 is highest)
const where: JobWhereInput = { priority: { lte: 2 } }

// Low priority jobs
const where: JobWhereInput = { priority: { gte: 5 } }

// Priority range
const where: JobWhereInput = { priority: { gte: 1, lte: 3 } }
```

## Filter by Flows

```typescript
// All jobs in a specific flow
const where: JobWhereInput = { flowId: "order-flow-abc123" }

// Root jobs only (no parent)
const where: JobWhereInput = { parentId: { isNull: true } }

// Child jobs only (have a parent)
const where: JobWhereInput = { parentId: { isNull: false } }

// Children of a specific parent
const where: JobWhereInput = { parentId: "parent-job-id" }

// All jobs in any flow
const where: JobWhereInput = { flowId: { isNull: false } }
```

## Filter by Scheduling

```typescript
// Only cron/recurring jobs
const where: JobWhereInput = { cron: { isNull: false } }

// Only one-off jobs (no cron)
const where: JobWhereInput = { cron: { isNull: true } }

// Jobs with a timeout configured
const where: JobWhereInput = { timeout: { isNull: false } }
```

## Filter by Attempts

```typescript
// Jobs that have been retried at least once
const where: JobWhereInput = { attempts: { gt: 1 } }

// Jobs with no attempts yet
const where: JobWhereInput = { attempts: { eq: 0 } }
```

## Combined AND/OR Filters

All top-level fields in `JobWhereInput` are implicitly AND'd together:

```typescript
// Status is "failed" AND name contains "email" AND created recently
const where: JobWhereInput = {
  status: "failed",
  name: { contains: "email" },
  createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
}
```

### OR — match any of several conditions

```typescript
// Jobs that are either failed OR dead
const where: JobWhereInput = {
  OR: [{ status: "failed" }, { status: "dead" }],
}
```

### Combining AND + OR

```typescript
// High priority jobs that are either email or SMS related
const where: JobWhereInput = {
  priority: { lte: 2 },
  OR: [{ name: { contains: "email" } }, { name: { contains: "sms" } }],
}
```

### Nested AND inside OR

```typescript
// Match either: (failed emails) OR (dead notifications)
const where: JobWhereInput = {
  OR: [
    { status: "failed", name: { contains: "email" } },
    { status: "dead", name: { contains: "notification" } },
  ],
}
```

### Explicit AND array

```typescript
// Same as implicit AND, but explicit
const where: JobWhereInput = {
  AND: [
    { status: "pending" },
    { priority: { lte: 3 } },
    { createdAt: { gte: "2024-01-01T00:00:00Z" } },
  ],
}
```

### Complex nested example

```typescript
// Find high-priority jobs in a flow that are stuck (failed or processing too long)
const where: JobWhereInput = {
  flowId: { isNull: false },
  priority: { lte: 2 },
  OR: [
    { status: "failed" },
    {
      status: "processing",
      processAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
  ],
}
```

## Shorthand Syntax

For convenience, string and number fields accept scalar shorthands:

```typescript
// These are equivalent:
{
  name: "send-email"
}
{
  name: {
    eq: "send-email"
  }
}

// These are equivalent:
{
  priority: 1
}
{
  priority: {
    eq: 1
  }
}

// These are equivalent:
{
  status: "pending"
}
{
  status: {
    eq: "pending"
  }
}
```

Use `normalizeWhere()` to expand shorthands before passing to adapter builders:

```typescript
import { normalizeWhere } from "@vorsteh-queue/query-builder"

const normalized = normalizeWhere({ status: "pending", name: "send-email" })
// → { status: { eq: "pending" }, name: { eq: "send-email" } }
```
