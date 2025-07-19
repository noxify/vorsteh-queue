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
  npx create-vorsteh-queue my-app --template=drizzle-pglite --package-manager=pnpm
  # Fully automated project creation
  ```

  ### CLI Flags
  - `--template=<name>` or `-t=<name>` - Choose template
  - `--package-manager=<pm>` or `-pm=<pm>` - Package manager (npm/pnpm/yarn/bun)
  - `--quiet` or `-q` - Minimal output for automation

  ## 📦 Available Templates

  Templates are **dynamically discovered** from the repository:
  - **drizzle-postgres-example** - Advanced example using Drizzle ORM with postgres.js and recurring jobs
  - **drizzle-pg-example** - Basic example using Drizzle ORM with node-postgres (pg)
  - **drizzle-pglite-example** - Zero-setup example using Drizzle ORM with PGlite (embedded PostgreSQL)
  - **progress-tracking-example** - Real-time job progress tracking using Drizzle ORM with postgres.js
  - **event-system-example** - Comprehensive event monitoring and statistics using Drizzle ORM with postgres.js

  ## 🔧 Smart Features
  - **Latest versions** - Automatically fetches current package versions from npm registry
  - **Workspace replacement** - Converts workspace dependencies to npm versions
  - **Template validation** - Ensures selected templates exist and are valid
  - **Package manager detection** - Validates and uses specified package manager
  - **Error handling** - Graceful fallbacks and helpful error messages

  ## 🤖 Automation Ready

  Perfect for CI/CD pipelines and scripting:

  ```bash
  # Silent project creation
  npx create-vorsteh-queue worker-service \
    --template=drizzle-postgres \
    --package-manager=pnpm \
    --quiet
  ```

  ## 🎨 Developer Experience
  - **Colorful output** with picocolors for enhanced readability
  - **Progress indicators** with spinners for long-running operations
  - **Helpful links** to documentation and examples
  - **Validation** with clear error messages and suggestions
  - **Cross-platform** support for Windows, macOS, and Linux
