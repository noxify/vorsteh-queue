# @vorsteh-queue/adapter-drizzle

## 0.2.0

### Minor Changes

- 51f5968: - `PostgresQueueAdapter`: Constructor simplified
  - **BREAKING**: Removed MariaDB/MySQL support due to timezone handling complexities
    - I tried my best to make it work, but failed successfully
  - **BREAKING**: Fixed UTC-first timezone handling - all timestamps now stored as UTC

  **Before (duplicate queue name)**

  ```ts
  const adapter = new PostgresQueueAdapter(db, "my-queue")
  const queue = new Queue(adapter, { name: "my-queue" })
  ```

  **After (single queue name):**

  ```ts
  const adapter = new PostgresQueueAdapter(db)
  const queue = new Queue(adapter, { name: "my-queue" })
  ```

  **Timezone Changes:**
  - Database schema now uses UTC defaults: `timezone('utc', now())` for PostgreSQL
  - Application timestamps stored as UTC using `toISOString()::timestamptz`
  - Consistent UTC-first behavior for reliable timezone handling

### Patch Changes

- Updated dependencies [51f5968]
  - @vorsteh-queue/core@0.2.0

## 0.1.0

### Minor Changes

- 8527495: # 🚀 Initial Release - Drizzle ORM Adapter

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

  **with PostgreSQL:**

  ```typescript
  // PostgreSQL
  import { PostgresQueueAdapter, postgresSchema } from "@vorsteh-queue/adapter-drizzle"

  const db = drizzle(pool, { schema: postgresSchema })
  const adapter = new PostgresQueueAdapter(db, "my-queue")
  ```

  **with MariaDB/MySQL:**

  ```
  // MariaDB/MySQL
  import { MariaDBQueueAdapter, mariadbSchema } from "@vorsteh-queue/adapter-drizzle"
  const db = drizzle(connection, { schema: mariadbSchema })
  const adapter = new MariaDBQueueAdapter(db, "my-queue")
  ```

### Patch Changes

- Updated dependencies [8527495]
  - @vorsteh-queue/core@0.1.0
