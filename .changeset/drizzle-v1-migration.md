---
"@vorsteh-queue/adapter-drizzle": major
"@vorsteh-queue/query-builder": major
---

## Breaking: drizzle-orm peer dependency bumped to >=1.0.0-rc

The minimum `drizzle-orm` peer dependency has been raised from `>=0.45.x` to `>=1.0.0-rc` for both the adapter and query builder packages.

### Migration steps

- Upgrade `drizzle-orm` to `>=1.0.0-rc` in your project
- Pass `{ relations }` to your `drizzle()` instance to enable Relational Query Builder v2 support
- The query builder's `buildWhere` now returns a plain RQB v2 where object instead of SQL conditions
