---
"@vorsteh-queue/adapter-typeorm": major
"@vorsteh-queue/core": patch
"@vorsteh-queue/query-builder": patch
---

## @vorsteh-queue/adapter-typeorm (new package)

Initial release of the TypeORM adapter for Vorsteh Queue.

### Features

- `PostgresTypeormQueueAdapter` — full implementation of the `QueueAdapter` interface
- PostgreSQL support via TypeORM's DataSource and Repository pattern
- Raw SQL job picking with `FOR UPDATE SKIP LOCKED` for reliable concurrent processing
- Pre-built `QueueJobEntity` with all required columns, types, and indexes
- Configurable table name and schema name

### Related changes

- `@vorsteh-queue/core`: Added `TypeormAdapterProps` interface and extended `AdapterKind` union
- `@vorsteh-queue/query-builder`: Added `./typeorm` export with TypeORM-compatible `buildWhere`
