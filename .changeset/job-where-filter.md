---
"@vorsteh-queue/core": major
"@vorsteh-queue/query-builder": minor
"@vorsteh-queue/adapter-drizzle": major
"@vorsteh-queue/adapter-prisma": major
"@vorsteh-queue/adapter-kysely": major
"@vorsteh-queue/server": major
"@vorsteh-queue/cli": major
---

## Job Where Filter

### Breaking: `getJobs` and `size` Signatures

Replaced flat `status`/`name` filter parameters with a composable `where` input supporting multiple filter conditions with comparison operators.

**Before:**
```typescript
adapter.getJobs({ status: "failed", name: "send-email", limit: 10 })
adapter.size()
```

**After:**
```typescript
adapter.getJobs({ where: { status: "failed", name: "send-email" }, limit: 10 })
adapter.size({ status: "failed" })
```

### Breaking: GraphQL Schema

- `jobs(queue, status, name, limit, offset)` → `jobs(queue, where: JobWhereInput, limit, offset)`
- `size(queue)` → `size(queue, where: JobWhereInput)`

### New: `@vorsteh-queue/query-builder`

New package providing filter normalization, in-memory matching, and ORM-specific where-clause builders:

- `normalizeWhere()` — expands shorthand filters
- `matchesWhere()` — in-memory job matching
- `buildWhere()` — translates to Drizzle/Kysely/Prisma conditions

### Supported Operators

- **String:** eq, neq, contains, startsWith, like, in, isNull
- **Int:** eq, neq, lt, lte, gt, gte, isNull
- **DateTime:** lt, lte, gt, gte, isNull
- **Status:** eq, neq, in
- **Null:** isNull
- **Logical:** AND, OR (recursive)
