---
"@vorsteh-queue/adapter-mikroorm": major
"@vorsteh-queue/core": patch
"@vorsteh-queue/query-builder": patch
---

## @vorsteh-queue/adapter-mikroorm (new package)

Initial release of the MikroORM adapter for Vorsteh Queue.

### Features

- `PostgresMikroormQueueAdapter` — full implementation of the `QueueAdapter` interface
- PostgreSQL support via MikroORM v6 EntityManager with unit of work pattern
- Raw SQL job picking with `FOR UPDATE SKIP LOCKED` for reliable concurrent processing
- Pre-built `QueueJobSchema` (EntitySchema) for quick database setup
- Configurable table name and schema name

### Related changes

- `@vorsteh-queue/core`: Added `MikroormAdapterProps` interface and extended `AdapterKind` union
- `@vorsteh-queue/query-builder`: Added `./mikroorm` export with MikroORM-compatible `buildWhere`
