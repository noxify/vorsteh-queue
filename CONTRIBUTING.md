# Contributing to Vorsteh Queue

Thank you for your interest in contributing to Vorsteh Queue! This document outlines our coding standards and contribution process.

## Code Style Guidelines

### TypeScript Conventions

- **Generic Type Parameters**: Always prefix with `T` to distinguish from concrete types

  ```typescript
  // ✅ Good
  interface BaseJob<TJobPayload = unknown> {
    payload: TJobPayload
  }

  function process<TJobPayload, TResult>(job: BaseJob<TJobPayload>): Promise<TResult>

  // ❌ Avoid
  interface BaseJob<JobPayload = unknown> {
    payload: JobPayload
  }

  function process<T, R>(job: BaseJob<T>): Promise<R>
  ```

- **Naming Conventions**:
  - Variables and functions: `camelCase`
  - Types and interfaces: `PascalCase`
  - Generic parameters: `T` prefix + `PascalCase` (e.g., `TJobPayload`, `TEventData`)

### Code Quality

- Remove all `console.log` statements from production code
- Use proper TypeScript types instead of `any`
- Prefer type-fest utility types over custom implementations
- Write self-documenting code with meaningful names
- Add JSDoc comments for public APIs

### Import Organization

Follow this import order:

1. Types first (with `import type`)
2. React/Next.js/Expo (if applicable)
3. Third-party modules
4. @vorsteh-queue packages
5. Relative imports (`~/`, `../`, `./`)

**Import Path Conventions**:
- No file extensions: Never use `.js`, `.ts` extensions
- Prefer directory imports: Use `../src` instead of `../src/index`
- Avoid useless path segments: Skip `/index` when possible

## Pull Request Process

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes following the style guidelines
4. Add tests for new functionality
5. Ensure all tests pass: `pnpm test`
6. Run type checking: `pnpm typecheck`
7. Run linting: `pnpm lint`
8. Fix format issues: `pnpm format:fix`
9. Submit a pull request with a clear description

## Development Setup

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint code
pnpm lint
```

## Questions?

Feel free to open an issue for questions or discussions about contributing.
