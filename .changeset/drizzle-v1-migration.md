---
"@vorsteh-queue/adapter-drizzle": major
"@vorsteh-queue/query-builder": major
---

## Breaking: drizzle-orm peer dependency bumped to >=1.0.0-rc.4

The minimum `drizzle-orm` peer dependency has been raised from `>=0.45.x` to `>=1.0.0-rc.4` for both the adapter and query builder packages.

### Breaking: Drizzle client initialization

The `drizzle()` call now requires a `relations` object:

**Before:**

```typescript
import * as schema from "./schema"
const db = drizzle(pool, { schema })
```

**After:**

```typescript
import { relations } from "./schema"
const db = drizzle({ client: pool, relations })
```

### Migration steps

1. Upgrade `drizzle-orm` to `>=1.0.0-rc.4` and `drizzle-kit` to `>=1.0.0-rc.4`
2. Define your own relations with `defineRelations` including `queueJobs`
3. Pass `relations` (not `schema`) to your `drizzle()` call
4. The query builder's `buildWhere` now returns a plain RQB v2 where object instead of SQL conditions
