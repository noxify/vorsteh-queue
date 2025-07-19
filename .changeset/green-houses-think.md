---
"@vorsteh-queue/adapter-drizzle": minor
"@vorsteh-queue/core": minor
"create-vorsteh-queue": minor
---

# 🚀 Initial Release of Vorsteh Queue

A TypeScript-first job queue system with multiple database adapters, built for reliability and developer experience.

## ✨ Core Features

- **Type-safe job processing** with full TypeScript support and generic job payloads
- **Multiple database adapters** supporting Drizzle ORM, Prisma, and in-memory implementations
- **Priority queue system** with numeric priority (lower = higher priority)
- **Delayed job scheduling** for future execution
- **Recurring jobs** with cron expressions and interval-based repetition
- **Timezone-aware scheduling** with DST handling powered by date-fns
- **Real-time progress tracking** for long-running jobs
- **Comprehensive event system** for monitoring job lifecycle
- **Graceful shutdown** with clean job processing termination

## 🗄️ Database Adapters

- **@vorsteh-queue/adapter-drizzle** - PostgreSQL support via Drizzle ORM (node-postgres, postgres.js, PGlite)
- **@vorsteh-queue/adapter-prisma** - Multi-database support via Prisma (PostgreSQL, MySQL, SQLite, MongoDB)
- **Built-in memory adapter** - For testing and development

## 🎛️ Advanced Configuration

- **Flexible job cleanup** - `removeOnComplete`/`removeOnFail` support boolean (immediate/never) or number (keep N jobs)
- **Configurable concurrency** - Process multiple jobs simultaneously
- **Retry logic** with exponential backoff
- **Job timeouts** and error handling
- **Queue statistics** and monitoring

## 🌍 Timezone Support

- Schedule jobs in any IANA timezone
- Automatic DST transition handling
- Complex cron expressions with timezone awareness
- UTC storage with timezone-aware calculations

## 📊 Progress & Events

- Real-time job progress updates (0-100%)
- Complete job lifecycle events (added, processing, completed, failed, retried)
- Queue-level events (paused, resumed, stopped, error)
- Built-in statistics tracking

## 📚 Examples & Documentation

- **Basic usage examples** with Drizzle + node-postgres/postgres.js
- **Progress tracking demo** showing real-time updates
- **Event system showcase** with comprehensive monitoring
- **PM2 production deployment** with multiple specialized workers
- **Complete TypeScript examples** with proper typing

## 🛠️ Developer Experience

- Full TypeScript support with strict typing
- Comprehensive test coverage
- ESLint and Prettier configuration
- Multiple runnable examples
- Production-ready PM2 configuration

## 🎯 Production Ready

- Database persistence with connection pooling
- Process management with PM2
- Memory limits and auto-restart
- Log rotation and monitoring
- Graceful shutdown handling
- Health checks and error recovery
