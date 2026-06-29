# vorsteh-queue - Project Steering

## Project Overview

vorsteh-queue is a TypeScript-based job queue library published as a set of packages:

- `packages/core` - Core queue logic
- `packages/adapter-drizzle` - Drizzle ORM adapter
- `packages/adapter-prisma` - Prisma adapter
- `packages/adapter-kysely` - Kysely adapter
- `packages/create-vorsteh-queue` - CLI scaffolding tool
- `packages/shared-tests` - Shared test utilities
- `tooling/typescript` - Shared TypeScript configurations

## Monorepo Structure

- **Package manager**: pnpm (workspace monorepo)
- **Build orchestration**: Turborepo
- **Workspace packages**: `apps/*`, `packages/*`, `tooling/*`, `examples/*`
- **Workspace constraints**: sherif (runs on `postinstall`)
- **Versioning**: changesets

## Tooling

### Linting (oxlint via ultracite)

- Command: `pnpm lint` (check) / `pnpm lint:fix` (auto-fix)
- Config: `oxlint.config.ts` at workspace root
- Presets: `ultracite/oxlint/core`, `ultracite/oxlint/react`, `ultracite/oxlint/next`, `ultracite/oxlint/vitest`

### Formatting (oxfmt via ultracite)

- Command: `pnpm format` (check) / `pnpm format:fix` (auto-fix)
- Config: `oxfmt.config.ts` at workspace root
- Settings: line width 100, no semicolons, ES5 trailing commas, auto import sorting

### Type Checking

- Command: `pnpm typecheck`
- TypeScript 6.x with shared configs from `tooling/typescript`

### Testing

- Framework: Vitest
- Command: `pnpm test` (watch) / `vitest --run` (single run)
- Per-package: `pnpm test:core`, `pnpm test:drizzle`, `pnpm test:prisma`, `pnpm test:kysely`
- Coverage: `@vitest/coverage-v8`

### Building

- Command: `pnpm build` (all) / `pnpm build:pkg` (packages only)
- Turborepo handles dependency ordering

## Code Style & Conventions

### TypeScript

- Use `import type` for type-only imports
- Prefix unused variables with `_`
- Use proper type guards instead of non-null assertions (`!`)
- Prefer `??` over `||` for null/undefined checks
- Prefer `?.` for optional property access
- No `.js` / `.ts` extensions in imports
- Prefer directory imports over explicit `/index` paths
- Use `readonly T[]` over `ReadonlyArray<T>`
- Generic type parameters: always prefix with `T` (e.g., `TJobPayload`, `TResult`, `TEventData`)
- Prefer explicit return types for exported functions
- No `any` - use proper types or `unknown`
- Use type-fest utility types when available over custom implementations

### Formatting

- No semicolons
- 100 character line width
- ES5 trailing commas
- Import order (handled by oxfmt):
  1. Type imports
  2. React/Next.js/Expo
  3. Third-party modules
  4. `@vorsteh-queue` packages
  5. Relative imports (`~/`, `../`, `./`)

### Documentation (JSDoc)

All public-facing code must have JSDoc headers:

- Classes: describe purpose, include `@example` where useful
- Functions/Methods: describe what it does, `@param`, `@returns`, `@throws`, `@example`
- Interface properties: inline `/** description */` with `@default` where applicable
- Type aliases: describe what the type represents
- Enums/Constants: describe each member

````typescript
/**
 * Register a job handler for a specific job type.
 *
 * @param name - The job type name (must be unique per queue)
 * @param handler - Function to process jobs of this type
 * @throws {Error} If a handler with this name is already registered
 *
 * @example
 * ```typescript
 * queue.register("send-email", async (job) => {
 *   await sendEmail(job.payload.to)
 *   return { sent: true }
 * })
 * ```
 */
````

```typescript
interface JobOptions {
  /** Job priority (lower number = higher priority)
   * @default 2
   */
  readonly priority?: number

  /** Delay in milliseconds before job becomes available
   * @default undefined (no delay)
   */
  readonly delay?: number
}
```

Do NOT add JSDoc to:

- Private/internal helpers (unless complex logic)
- Test files
- Obvious one-liner utility functions

### General

- No `console.log` - remove debug statements
- Prefer functional programming patterns
- Prefer composition over inheritance
- Use readonly arrays and objects where appropriate
- Write self-documenting code; minimize inline comments
- Use proper error handling (no generic `throw new Error`)
- camelCase for variables/functions, PascalCase for types/interfaces/classes

## Verification Workflow

After making code changes, always verify with these commands (in this order):

1. `pnpm format:fix` — Apply formatting
2. `pnpm lint:fix` — Auto-fix lint issues
3. `pnpm typecheck` — Verify types
4. `vitest --run` — Run tests (single run, no watch mode)

Never use `npx`, `pnpm dlx`, or call tools directly (e.g. `oxlint`, `oxfmt`). Always use the pnpm scripts defined in the root `package.json`.

## Commands Reference

| Task               | Command            |
| ------------------ | ------------------ |
| Install            | `pnpm install`     |
| Dev (packages)     | `pnpm dev`         |
| Dev (docs)         | `pnpm dev:docs`    |
| Build all          | `pnpm build`       |
| Build packages     | `pnpm build:pkg`   |
| Lint               | `pnpm lint`        |
| Lint fix           | `pnpm lint:fix`    |
| Format check       | `pnpm format`      |
| Format fix         | `pnpm format:fix`  |
| Typecheck          | `pnpm typecheck`   |
| Test (watch)       | `pnpm test`        |
| Test (single run)  | `vitest --run`     |
| Changeset          | `pnpm cs`          |
| Clean node_modules | `pnpm clean`       |
| Clean turbo cache  | `pnpm clean:cache` |
