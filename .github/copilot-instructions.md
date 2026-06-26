# GitHub Copilot Instructions

## Development Philosophy

- **Quality over quantity**: Write clean, maintainable, and well-structured code
- **Senior-level TypeScript**: Leverage advanced TypeScript features for type safety
- **Minimal and focused**: Every line of code should serve a clear purpose
- **Performance-conscious**: Consider efficiency and avoid unnecessary complexity

## TypeScript & Linting Rules (oxlint via ultracite)

- **No console.log**: Use proper logging or remove debug statements (`no-console: error`)
- **Consistent type imports**: Use `import type` for type-only imports
- **No unused vars**: Prefix with `_` if intentionally unused
- **No unnecessary conditions**: Avoid redundant null checks
- **No non-null assertions**: Use proper type guards instead of `!`
- **Prefer top-level type imports**: Keep type imports at the top
- **Array type syntax**: Use `readonly T[]` instead of `ReadonlyArray<T>`
- **Prefer nullish coalescing**: Use `??` instead of `||` for safer null/undefined checks
- **Prefer optional chaining**: Use `?.` for more concise and readable property access
- **No import extensions**: Never use `.js`, `.ts` extensions in imports
- **No useless path segments**: Avoid `/index` in import paths when possible
- **Prefer directory imports**: Use `../src` instead of `../src/index` for cleaner imports

## Formatting Configuration (oxfmt via ultracite)

- **Line width**: 100 characters max
- **No semicolons**: Use semicolon-free style
- **Trailing commas**: ES5 style
- **Import sorting**: Handled automatically by oxfmt (`sortImports: true`)
- **Import order** (enforced by oxfmt):
  1. Types first
  2. React/Next.js/Expo (if applicable)
  3. Third-party modules
  4. @vorsteh-queue packages
  5. Relative imports (~/,../, ./)

## Tooling & Verification

After making code changes, verify with these commands (in this order):

1. `pnpm format:fix` — Apply formatting
2. `pnpm lint:fix` — Auto-fix lint issues
3. `pnpm typecheck` — Verify types
4. `vitest --run` — Run tests (single run, no watch mode)

Always use the pnpm scripts from the root `package.json`. Never call tools directly via `npx` or `pnpm dlx`.

| Tool | Check | Fix |
|------|-------|-----|
| Formatter (oxfmt) | `pnpm format` | `pnpm format:fix` |
| Linter (oxlint) | `pnpm lint` | `pnpm lint:fix` |
| Types (TypeScript) | `pnpm typecheck` | — |
| Tests (Vitest) | `vitest --run` | — |
| Build (Turborepo) | `pnpm build` | — |
| Workspace (sherif) | `pnpm lint:ws` | — |

## Code Generation Guidelines

- Remove all `console.log` statements from generated code
- Use proper TypeScript types instead of `any` when possible
- **Use type-fest when available** - Prefer battle-tested utility types from type-fest over custom implementations
- Add lint disable comments only when absolutely necessary
- Follow the import order enforced by oxfmt
- Use consistent naming conventions (camelCase for variables, PascalCase for types)
- **Generic type parameters**: Always prefix with `T` (e.g., `TJobPayload`, `TResult`, `TEventData`)
- Prefer explicit return types for functions
- Use proper error handling instead of throwing generic errors
- Write self-documenting code that doesn't need excessive comments
- Prefer functional programming patterns where appropriate
- Use advanced TypeScript features (generics, utility types, conditional types)
- Optimize for readability and maintainability

## File Structure

- Keep imports organized according to oxfmt rules
- Use meaningful variable and function names
- Add proper JSDoc comments for public APIs
- Prefer composition over inheritance
- Use readonly arrays and objects where appropriate
