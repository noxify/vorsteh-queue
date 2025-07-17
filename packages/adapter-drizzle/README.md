# @vorsteh-queue/adapter-drizzle

PostgreSQL adapter for vorsteh-queue using Drizzle ORM with SKIP LOCKED support.

## Installation

```bash
pnpm add @vorsteh-queue/adapter-drizzle drizzle-orm

# Choose your PostgreSQL driver:
# Option 1: postgres.js
pnpm add postgres

# Option 2: node-postgres (pg)
pnpm add pg @types/pg
```

## Usage

### With postgres.js

```typescript
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { DrizzleQueueAdapter, schema } from "@vorsteh-queue/adapter-drizzle"

const client = postgres(connectionString)
const db = drizzle(client, { schema })
const adapter = new DrizzleQueueAdapter(db, "my-queue")
```

### With node-postgres (pg)

```typescript
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { DrizzleQueueAdapter, schema } from "@vorsteh-queue/adapter-drizzle"

const pool = new Pool({ connectionString })
const db = drizzle(pool, { schema })
const adapter = new DrizzleQueueAdapter(db, "my-queue")
```

## Database Setup

The adapter exports the Drizzle schema that you can use with your preferred migration strategy:

```typescript
// Option 1: Use drizzle-kit CLI
// drizzle-kit push:pg --schema=./node_modules/@vorsteh-queue/adapter-drizzle/dist/schema.js

// Option 2: Use drizzle-kit/api
import { pushSchema } from "drizzle-kit/api"

import { schema } from "@vorsteh-queue/adapter-drizzle"

const { apply } = await pushSchema(schema, db)
await apply()

// Option 3: Use your own migration system
// The schema defines a 'queue_jobs' table with appropriate indexes
```

## Features

- ✅ SKIP LOCKED for concurrent job processing
- ✅ Full scheduling support (cron, recurring, delayed)
- ✅ Priority-based job ordering
- ✅ JSONB payload storage
- ✅ Optimized indexing
- ✅ Transaction support
- ✅ Works with both postgres.js and node-postgres
