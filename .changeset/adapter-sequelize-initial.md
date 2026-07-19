---
"@vorsteh-queue/adapter-sequelize": major
"@vorsteh-queue/core": patch
"@vorsteh-queue/query-builder": patch
---

## @vorsteh-queue/adapter-sequelize (new package)

Initial release of the Sequelize adapter for Vorsteh Queue.

### Features

- `PostgresSequelizeQueueAdapter` — full implementation of the `QueueAdapter` interface
- PostgreSQL support via Sequelize Model pattern with raw SQL for job picking
- Raw SQL job picking with `FOR UPDATE SKIP LOCKED` for reliable concurrent processing
- Pre-built `QueueJobModel` with `initQueueJobModel()` for quick model registration
- Configurable table name and schema name

### Related changes

- `@vorsteh-queue/core`: Added `SequelizeAdapterProps` interface and extended `AdapterKind` union
- `@vorsteh-queue/query-builder`: Added `./sequelize` export with Sequelize-compatible `buildWhere`
