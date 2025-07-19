# create-vorsteh-queue

Create Vorsteh Queue applications with one command.

## Usage

### Interactive Mode

```bash
# Full interactive experience
npx create-vorsteh-queue
```

### Direct Mode

```bash
# With project name
npx create-vorsteh-queue my-queue-app

# With template selection
npx create-vorsteh-queue my-app --template=drizzle-pglite
npx create-vorsteh-queue my-app -t=progress-tracking

# With package manager
npx create-vorsteh-queue my-app --package-manager=pnpm
npx create-vorsteh-queue my-app -pm=yarn

# Quiet mode (minimal output)
npx create-vorsteh-queue my-app --quiet
npx create-vorsteh-queue my-app -q

# Fully automated (no prompts)
npx create-vorsteh-queue my-app -t=drizzle-pglite -pm=pnpm --quiet

# Skip dependency installation
npx create-vorsteh-queue my-app -t=drizzle-pglite --no-install --quiet
```

## CLI Options

| Option                   | Short       | Description             | Example             |
| ------------------------ | ----------- | ----------------------- | ------------------- |
| `--template=<name>`      | `-t=<name>` | Choose template         | `-t=drizzle-pglite` |
| `--package-manager=<pm>` | `-pm=<pm>`  | Package manager         | `-pm=pnpm`          |
| `--no-install`           | -           | Skip dependency install | `--no-install`      |
| `--quiet`                | `-q`        | Minimal output          | `--quiet`           |

### Package Managers

- **npm** - Default Node.js package manager
- **pnpm** - Fast, disk space efficient
- **yarn** - Popular alternative
- **bun** - Ultra-fast (experimental)

## 📦 Available Templates

Templates are **dynamically discovered** from the repository:

- **drizzle-pg** - Basic example using Drizzle ORM with node-postgres (pg)
- **drizzle-pglite** - Zero-setup example using Drizzle ORM with PGlite (embedded PostgreSQL)
- **drizzle-postgres** - Advanced example using Drizzle ORM with postgres.js and recurring jobs
- **event-system** - Comprehensive event monitoring and statistics using Drizzle ORM with postgres.js
- **pm2-workers** - Manage multiple Vorsteh Queues with PM2 using Drizzle ORM with postgres.js
- **progress-tracking** - Real-time job progress tracking using Drizzle ORM with postgres.js

> Templates are automatically fetched from the examples directory, so new examples are immediately available!

## Examples

### Interactive Usage

```bash
┌  create-vorsteh-queue
│
◇  What is your project name?
│  my-queue-app
│
◇  Choose a template:
│  ● drizzle-pglite-example (Embedded PostgreSQL with zero setup)
│
◇  Install dependencies?
│  Yes
│
◇  Which package manager?
│  ● pnpm
│
└  🎉 Project created successfully!

Next steps:
  cd my-queue-app
  pnpm run dev
```

### Automated Usage

```bash
# Perfect for scripts and CI/CD
npx create-vorsteh-queue worker-service \
  --template=drizzle-postgres \
  --package-manager=pnpm \
  --quiet \
  --no-install
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Build for production
pnpm build
```
