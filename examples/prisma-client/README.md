# Prisma Client Example

This example demonstrates using Vorsteh Queue with Prisma's `prisma-client` provider and PostgreSQL, which generates TypeScript files directly.

## Features

- **Prisma Client**: Uses `provider = "prisma-client"` with TypeScript generation
- **PostgreSQL Database**: Uses PostgreSQL as the database engine
- **Custom Output**: Generated client in `src/generated/prisma/`
- **ESM Module Format**: TypeScript files with `.ts` extensions
- **Email Queue**: Simple job processing with progress tracking

## Generator Configuration

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  
  runtime                = "nodejs"
  moduleFormat           = "esm"
  generatedFileExtension = "ts"
  importFileExtension    = "ts"
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

- Imports from `"./generated/prisma/index.ts"` (TypeScript)
- Generated files are TypeScript with full type safety
- Optimized for modern TypeScript projects