# Prisma Client JS Example

This example demonstrates using Vorsteh Queue with Prisma's traditional `prisma-client-js` provider and PostgreSQL for backward compatibility.

## Features

- **Traditional Prisma**: Uses `provider = "prisma-client-js"`
- **PostgreSQL Database**: Uses PostgreSQL as the database engine
- **Custom Output**: Generated client in `src/generated/prisma/`
- **JavaScript Generation**: Standard JavaScript files with TypeScript definitions
- **Email Queue**: Simple job processing with progress tracking

## Generator Configuration

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../src/generated/prisma"
}
```

## Setup

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Update `DATABASE_URL` in `.env` with your PostgreSQL connection string

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Generate Prisma client:
   ```bash
   pnpm prisma:generate
   ```

5. Run database migrations:
   ```bash
   pnpm prisma:migrate
   ```

6. Start the example:
   ```bash
   pnpm dev
   ```

## Key Differences

- Imports from `"./generated/prisma/index.js"` (JavaScript)
- Generated files are JavaScript with separate `.d.ts` files
- Compatible with existing Prisma setups