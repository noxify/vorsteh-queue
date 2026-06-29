---
"@vorsteh-queue/cli": minor
---

## @vorsteh-queue/cli — Initial Release

CLI tool for monitoring and managing vorsteh-queue jobs.

- Commands: `status`, `inspect`, `cancel`, `redrive`, `clear`
- Transports: direct adapter connection or remote GraphQL server
- `--json` flag on all commands for machine-readable output
- Configuration via environment variables (`VORSTEH_QUEUE_URL`, `VORSTEH_QUEUE_TOKEN`)
- `defineCliConfig()` helper for typed configuration
- Built with citty (unjs CLI framework)
