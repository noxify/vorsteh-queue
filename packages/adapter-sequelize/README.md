# @vorsteh-queue/adapter-sequelize

The official Sequelize adapter for Vorsteh Queue.

Use Sequelize-backed PostgreSQL storage for your queue in minutes.

## Install

```bash
pnpm add @vorsteh-queue/adapter-sequelize sequelize pg
```

## What you get

- Sequelize-based queue persistence with Model pattern
- PostgreSQL locking and picking behavior for workers
- Seamless integration with @vorsteh-queue/core
- Pre-built `QueueJobModel` with `initQueueJobModel` helper for quick setup

## Requirements

- Node.js >= 22
- sequelize >= 6.0.0
- pg (PostgreSQL driver)

## Documentation

https://vorsteh-queue.dev/docs

## License

MIT ([LICENSE](../../LICENSE))
