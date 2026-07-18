# @vorsteh-queue/core — Migration Guide

## Breaking Changes: `getJobs` and `size` Signatures

### `getJobs`

The flat `status`/`name` parameters have been replaced by a composable `where` filter.

**Before:**

```typescript
const jobs = await adapter.getJobs({
  status: "failed",
  name: "send-email",
  limit: 10,
})
```

**After:**

```typescript
const jobs = await adapter.getJobs({
  where: { status: "failed", name: "send-email" },
  limit: 10,
})
```

The new signature:

```typescript
getJobs: (options: {
  where?: JobWhereInput
  limit?: number
  offset?: number
}) => Promise<readonly Job[]>
```

### `size`

`size()` now accepts an optional `where` filter to count matching jobs.

**Before:**

```typescript
const total = await adapter.size() // always returned total count
```

**After:**

```typescript
const total = await adapter.size() // total count (unchanged)
const failed = await adapter.size({ status: "failed" }) // filtered count
```

The new signature:

```typescript
size: (where?: JobWhereInput) => Promise<number>
```

### Migration Steps

1. Replace `getJobs({ status, name, ... })` with `getJobs({ where: { status, name }, ... })`
2. Replace any `status: "pending"` string values with the shorthand syntax (works as-is) or the explicit `status: { eq: "pending" }` form
3. Update `size()` calls that relied on counting all jobs — behavior is unchanged when called without arguments
4. Install `@vorsteh-queue/query-builder` if using filter types directly

### `JobWhereInput` Type

Import from core or from the query-builder package:

```typescript
import type { JobWhereInput } from "@vorsteh-queue/core"
// or
import type { JobWhereInput } from "@vorsteh-queue/query-builder"
```

See `@vorsteh-queue/query-builder` README for full filter operator documentation.
