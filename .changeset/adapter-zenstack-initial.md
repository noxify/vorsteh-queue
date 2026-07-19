---
"@vorsteh-queue/adapter-zenstack": major
"@vorsteh-queue/core": patch
"@vorsteh-queue/query-builder": patch
---

## @vorsteh-queue/adapter-zenstack (new package)

Initial release of the ZenStack ORM adapter for Vorsteh Queue.

### Features

- `PostgresZenstackQueueAdapter` — full implementation of the `QueueAdapter` interface
- PostgreSQL support via ZenStack ORM v3 (Prisma-compatible API built on Kysely)
- Raw SQL job picking with `FOR UPDATE SKIP LOCKED` for reliable concurrent processing
- Configurable model name, table name, and schema name
- ZModel schema provided for quick database setup

### Related changes

- `@vorsteh-queue/core`: Added `ZenstackAdapterProps` interface and extended `AdapterKind` union
- `@vorsteh-queue/query-builder`: Added `./zenstack` export (re-exports Prisma-compatible `buildWhere`)
