# Coding Standards for the vorsteh-queue Project

## Development Philosophy

- **Quality over quantity**: Write clean, maintainable, and well-structured code
- **Senior-level TypeScript**: Leverage advanced TypeScript features for type safety
- **Minimal and focused**: Every line of code should serve a clear purpose
- **Performance-conscious**: Consider efficiency and avoid unnecessary complexity

## TypeScript & ESLint Rules

- **No console.log**: Use proper logging or remove debug statements
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

## Prettier Configuration

- **Print width**: 100 characters max
- **No semicolons**: Use semicolon-free style
- **Import order**: Follow the specified import grouping:
  1. Types first
  2. React/Next.js/Expo (if applicable)
  3. Third-party modules
  4. @vorsteh-queue packages
  5. Relative imports (~/,../, ./)

## Code Generation Guidelines

- Remove all `console.log` statements from generated code
- Use proper TypeScript types instead of `any` when possible
- **Use type-fest when available** - Prefer battle-tested utility types from type-fest over custom implementations
- Add ESLint disable comments only when absolutely necessary
- Follow the import order specified in prettier config
- Use consistent naming conventions (camelCase for variables, PascalCase for types)
- **Generic type parameters**: Always prefix with `T` (e.g., `TJobPayload`, `TResult`, `TEventData`)
- Prefer explicit return types for functions
- Use proper error handling instead of throwing generic errors
- Write self-documenting code that doesn't need excessive comments
- Prefer functional programming patterns where appropriate
- Use advanced TypeScript features (generics, utility types, conditional types)
- Optimize for readability and maintainability

## File Structure

- Keep imports organized according to prettier rules
- Use meaningful variable and function names
- Add proper JSDoc comments for public APIs
- Prefer composition over inheritance
- Use readonly arrays and objects where appropriate
