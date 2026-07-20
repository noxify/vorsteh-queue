# TUI Dashboard — API Mode

Interactive TUI dashboard example using the GraphQL API transport. Runs a server with multiple queues, diverse job types, flows, and step-based workflows backed by PGlite (in-memory PostgreSQL).

## Usage

```bash
pnpm install
pnpm dev          # Starts GraphQL server + workers + seeds
```

In a second terminal:

```bash
pnpm dashboard    # Connects via http://localhost:4000/graphql
```

## Documentation

- [TUI Dashboard Guide](https://vorsteh-queue.dev/docs/examples/advanced/tui-dashboard)
- [CLI Overview](https://vorsteh-queue.dev/docs/cli/overview/installation)
- [Flow Trees](https://vorsteh-queue.dev/docs/vorsteh-queue/core/flows/flow-trees)
- [Drizzle Adapter](https://vorsteh-queue.dev/docs/vorsteh-queue/adapters/drizzle)
