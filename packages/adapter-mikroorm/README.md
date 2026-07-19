# @vorsteh-queue/adapter-mikroorm

The official MikroORM adapter for Vorsteh Queue.

Use MikroORM-backed PostgreSQL storage for your queue in minutes.

## Install

```bash
pnpm add @vorsteh-queue/adapter-mikroorm @mikro-orm/core @mikro-orm/postgresql
```

## What you get

- MikroORM-based queue persistence with entity schema pattern
- PostgreSQL locking and picking behavior for workers
- Seamless integration with @vorsteh-queue/core
- Pre-built `QueueJobEntity` using MikroORM v6 `defineEntity` (no decorators needed)

## Requirements

- Node.js >= 22
- @mikro-orm/core >= 6.0.0
- @mikro-orm/postgresql >= 6.0.0

## Documentation

https://vorsteh-queue.dev/docs

## License

MIT ([LICENSE](../../LICENSE))
