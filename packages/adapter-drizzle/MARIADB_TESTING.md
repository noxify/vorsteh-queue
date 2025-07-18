# MariaDB Testing Setup

## Prerequisites

1. **Docker Desktop** must be installed and running
2. **Node.js 18+** and **pnpm** installed

## Quick Start

```bash
# 1. Start Docker Desktop
# 2. Install dependencies
pnpm install

# 3. Run MariaDB tests
pnpm test:mariadb

# 4. Run all tests
pnpm test
```

## Manual MariaDB Setup (Alternative)

If you prefer not to use Docker:

```bash
# Install MariaDB locally (macOS)
brew install mariadb
brew services start mariadb

# Create test database
mysql -u root -e "CREATE DATABASE testdb;"

# Set environment variables
export MARIADB_HOST=localhost
export MARIADB_PORT=3306
export MARIADB_USER=root
export MARIADB_PASSWORD=
export MARIADB_DATABASE=testdb

# Run tests
pnpm test:mariadb:local
```

## Test Commands

- `pnpm test:mariadb` - Run MariaDB tests with Testcontainers
- `pnpm test:postgres` - Run PostgreSQL tests with PGlite
- `pnpm test` - Run all tests
- `pnpm test:watch` - Run tests in watch mode

## Troubleshooting

### Docker Issues

- Ensure Docker Desktop is running
- Try: `docker pull mariadb:10.6`
- Check Docker permissions

### Connection Issues

- MariaDB container takes ~10-15 seconds to start
- Tests have 2-minute timeout for container startup
- Check firewall settings

### Performance

- First run downloads MariaDB image (~200MB)
- Subsequent runs are much faster
- Container startup: ~10-15 seconds

## What the Tests Verify

✅ **Basic Operations**

- Job creation and retrieval
- SKIP LOCKED functionality
- Status updates
- Queue statistics

✅ **MariaDB-Specific Features**

- UUID generation with VARCHAR(36)
- JSON payload handling
- MySQL-specific query patterns

✅ **Scheduling Features**

- Cron job support
- Recurring jobs
- Delayed job processing

## CI/CD Integration

The tests work in GitHub Actions automatically:

```yaml
- name: Run MariaDB tests
  run: pnpm test:mariadb
```

Docker is pre-installed in GitHub runners, so no additional setup needed.
