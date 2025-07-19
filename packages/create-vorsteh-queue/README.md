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

# Fully automated
npx create-vorsteh-queue my-app -t=drizzle-pglite -pm=pnpm --quiet
```

## CLI Options

| Option                   | Short       | Description     | Example             |
| ------------------------ | ----------- | --------------- | ------------------- |
| `--template=<name>`      | `-t=<name>` | Choose template | `-t=drizzle-pglite` |
| `--package-manager=<pm>` | `-pm=<pm>`  | Package manager | `-pm=pnpm`          |
| `--quiet`                | `-q`        | Minimal output  | `--quiet`           |

### Package Managers

- **npm** - Default Node.js package manager
- **pnpm** - Fast, disk space efficient
- **yarn** - Popular alternative
- **bun** - Ultra-fast (experimental)

## Available Templates

Templates are **dynamically discovered** from the GitHub repository:

- **drizzle-postgres-example** - Advanced example using Drizzle ORM with postgres.js and recurring jobs
- **drizzle-pg-example** - Basic example using Drizzle ORM with node-postgres (pg)
- **drizzle-pglite-example** - Zero-setup example using Drizzle ORM with PGlite (embedded PostgreSQL)
- **progress-tracking-example** - Real-time job progress tracking using Drizzle ORM with postgres.js
- **event-system-example** - Comprehensive event monitoring and statistics using Drizzle ORM with postgres.js

> Templates are automatically fetched from the examples directory, so new examples are immediately available!

## Features

- 🚀 **Interactive CLI** - Beautiful prompts with @clack/prompts
- 📦 **Dynamic templates** - Auto-discovered from GitHub repository
- 🔄 **Latest versions** - Fetches current versions from npm registry
- 🎨 **Colorful output** - Enhanced terminal experience with picocolors
- 🔗 **Helpful links** - Direct links to documentation
- ⚡ **Fast downloads** - Efficient template downloading with giget
- 🤫 **Quiet mode** - Silent operation for automation
- 🛠️ **Multiple package managers** - npm, pnpm, yarn, bun support
- 🎯 **CLI flags** - Full automation support

## What it does

1. **Discovers templates** - Dynamically fetches available templates from GitHub
2. **Prompts for details** - Name, template, package manager (if not provided via CLI)
3. **Downloads template** - Uses giget to efficiently download from GitHub
4. **Updates package.json** - Replaces workspace dependencies with latest npm versions
5. **Installs dependencies** - Uses selected package manager
6. **Provides guidance** - Shows next steps with correct commands

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
  --quiet
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Build for production
pnpm build

# Test locally
npx tsx src/index.ts my-test-app
```

## Architecture

- **Dynamic Discovery** - Templates fetched from GitHub API
- **Smart Caching** - giget handles efficient downloads
- **Version Management** - npm registry API for latest versions
- **Graceful Fallbacks** - Works offline with cached templates
- **Cross-platform** - Works on Windows, macOS, Linux
