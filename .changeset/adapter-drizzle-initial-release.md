---
"@vorsteh-queue/adapter-drizzle": minor
---

# 🚀 Initial Release - Drizzle ORM Adapter

Database adapter supporting PostgreSQL and MariaDB/MySQL via Drizzle ORM.

## 🗄️ Database Support

### PostgreSQL
- **PostgreSQL 12+** with SKIP LOCKED support for concurrent processing
- **Multiple drivers**: node-postgres, postgres.js, PGlite
- **Full feature support**: JSONB payloads, UUID primary keys, timezone-aware timestamps
- **Connection pooling** and transaction support

### MariaDB/MySQL  
- **MariaDB 10.6+** and **MySQL 8.0+** with SKIP LOCKED functionality
- **mysql2 driver** with promise support and connection pooling
- **JSON payloads** with proper serialization/deserialization
- **UUID compatibility** using VARCHAR(36) with MySQL UUID() function

## ⚡ Performance Features

- **SKIP LOCKED** queries for high-concurrency job processing without lock contention
- **Optimized indexes** on queue_name, status, priority, and process_at columns
- **Efficient job retrieval** with priority-based ordering and creation time fallback
- **Batch operations** for job cleanup and maintenance

## 🔧 Schema Management

- **Exported schemas** - `postgresSchema` and `mariadbSchema` for easy integration
- **Drizzle Kit support** - Generate and run migrations with your existing schema
- **Type-safe queries** - Full TypeScript support with Drizzle's query builder
- **Flexible integration** - Works with existing Drizzle setups

## 📦 Easy Integration

```typescript
// PostgreSQL
import { PostgresQueueAdapter, postgresSchema } from "@vorsteh-queue/adapter-drizzle"
const db = drizzle(pool, { schema: postgresSchema })
const adapter = new PostgresQueueAdapter(db, "my-queue")

// MariaDB/MySQL
import { MariaDBQueueAdapter, mariadbSchema } from "@vorsteh-queue/adapter-drizzle"
const db = drizzle(connection, { schema: mariadbSchema })
const adapter = new MariaDBQueueAdapter(db, "my-queue")
```

## 🛡️ Enterprise Features

- **Connection pooling** support for high-throughput applications
- **Transaction support** for atomic job operations
- **Error handling** with proper database-specific error types
- **Schema validation** and type safety throughout