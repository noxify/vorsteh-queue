# create-vorsteh-queue

## 0.1.0

### Minor Changes

- 8527495: # 🚀 Initial Release - Project Scaffolding CLI

  Interactive CLI tool for creating new Vorsteh Queue projects with zero configuration.

  ## ✨ Features
  - **Interactive prompts** with beautiful UI powered by @clack/prompts
  - **Dynamic template discovery** - Automatically fetches available templates from GitHub
  - **Multiple package managers** - Support for npm, pnpm, yarn, and bun
  - **CLI flags** for automation and scripting
  - **Quiet mode** for CI/CD environments

  ## 🎯 Usage Options

  ### Interactive Mode

  ```bash
  npx create-vorsteh-queue
  # Prompts for project name, template, and package manager
  ```

  ### Direct Mode

  ```bash
  npx create-vorsteh-queue my-app --template=drizzle-pglite --package-manager=pnpm --no-install
  # Fully automated project creation
  ```

  ### CLI Flags
  - `--template=<name>` or `-t=<name>` - Choose template
  - `--package-manager=<pm>` or `-pm=<pm>` - Package manager (npm/pnpm/yarn/bun)
  - `--no-install` - Skip dependency install
  - `--quiet` or `-q` - Minimal output for automation

  ## 📦 Available Templates

  Templates are **dynamically discovered** from the repository:
  - **drizzle-pg** - Basic example using Drizzle ORM with node-postgres (pg)
  - **drizzle-pglite** - Zero-setup example using Drizzle ORM with PGlite (embedded PostgreSQL)
  - **drizzle-postgres** - Advanced example using Drizzle ORM with postgres.js and recurring jobs
  - **event-system** - Comprehensive event monitoring and statistics using Drizzle ORM with postgres.js
  - **pm2-workers** - Manage multiple Vorsteh Queues with PM2 using Drizzle ORM with postgres.js
  - **progress-tracking** - Real-time job progress tracking using Drizzle ORM with postgres.js
