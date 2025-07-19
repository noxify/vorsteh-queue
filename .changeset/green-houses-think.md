---
---

# 🚀 Vorsteh Queue - Initial Release

A powerful, TypeScript-first job queue system designed for modern applications.

## 📦 What's Included

This release introduces three core packages:

- **@vorsteh-queue/core** - The foundational queue engine with type-safe job processing
- **@vorsteh-queue/adapter-drizzle** - Production-ready PostgreSQL and MariaDB/MySQL adapter
- **create-vorsteh-queue** - Interactive CLI for scaffolding new projects

## 🎯 Key Highlights

- **Zero-config setup** with the CLI tool - `npx create-vorsteh-queue`
- **Production-ready** database adapters with connection pooling and SKIP LOCKED
- **Type-safe throughout** with full TypeScript support and generic job payloads
- **Timezone-aware scheduling** with automatic DST handling
- **Real-time progress tracking** and comprehensive event system
- **Multiple examples** covering basic usage to production deployment

## 🚀 Quick Start

```bash
# Create a new project
npx create-vorsteh-queue my-queue-app

# Choose from multiple templates:
# - drizzle-postgres (Production ready)
# - drizzle-pglite (Zero setup)
# - progress-tracking (Real-time updates)
# - event-system (Comprehensive monitoring)
```

## 🛠️ Developer Experience

Built with developer experience in mind:

- **Interactive CLI** with beautiful prompts and dynamic template discovery
- **Comprehensive examples** with runnable code for every feature
- **Production deployment** guides with PM2 and Docker
- **Full documentation** with TypeScript examples throughout

See individual package changesets for detailed feature lists and technical specifications.
