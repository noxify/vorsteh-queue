# @vorsteh-queue/adapter-typeorm

The official TypeORM adapter for Vorsteh Queue.

Use TypeORM-backed PostgreSQL storage for your queue in minutes.

## Install

```bash
pnpm add @vorsteh-queue/adapter-typeorm typeorm
```

## What you get

- TypeORM-based queue persistence with entity and repository pattern
- PostgreSQL locking and picking behavior for workers
- Seamless integration with @vorsteh-queue/core
- Pre-built `QueueJobEntity` for quick setup with `synchronize: true`

## Requirements

- Node.js >= 22
- typeorm >= 0.3.0

## Documentation

https://vorsteh-queue.dev/docs

## License

MIT ([LICENSE](../../LICENSE))
