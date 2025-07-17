# PM2 Workers Example

This example demonstrates running multiple queue workers with PM2 process manager for production deployment.

## Features Demonstrated

- **Multiple specialized workers** - Email, Image processing, and Report generation
- **PM2 process management** - Clustering, auto-restart, and monitoring
- **Production configuration** - Memory limits, log rotation, and error handling
- **Graceful shutdown** - Clean worker termination
- **Job distribution** - Different queues for different job types
- **Monitoring and logging** - Comprehensive process monitoring

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   Producer      │    │   PostgreSQL     │
│   (Add Jobs)    │───▶│   Database       │
└─────────────────┘    └──────────────────┘
                                │
                       ┌────────┼────────┐
                       ▼        ▼        ▼
              ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
              │Email Worker │ │Image Worker │ │Report Worker│
              │(2 instances)│ │(1 instance) │ │(1 instance) │
              └─────────────┘ └─────────────┘ └─────────────┘
```

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Set up PostgreSQL database and update connection string in `.env`:
```bash
cp .env.example .env
# Edit .env with your database URL
```

3. Push database schema:
```bash
pnpm db:push
```

## Running with PM2

### Start all workers:
```bash
pnpm start
```

### Monitor workers:
```bash
pnpm monit    # Interactive monitoring
pnpm logs     # View logs
```

### Control workers:
```bash
pnpm restart  # Restart all workers
pnpm stop     # Stop all workers
pnpm delete   # Delete all workers
```

## Adding Jobs

### Add sample jobs once:
```bash
pnpm dev
```

### Add jobs continuously (for testing):
```bash
tsx src/producer.ts --continuous
```

## Worker Configuration

### Email Worker
- **Instances**: 2 (cluster mode)
- **Concurrency**: 3 jobs per instance
- **Memory limit**: 500MB
- **Jobs**: Welcome emails, notifications

### Image Worker  
- **Instances**: 1 (fork mode)
- **Concurrency**: 2 jobs per instance
- **Memory limit**: 1GB
- **Jobs**: Image resizing, optimization

### Report Worker
- **Instances**: 1 (fork mode)
- **Concurrency**: 1 job per instance
- **Memory limit**: 2GB
- **Restart**: Daily at 2 AM
- **Jobs**: Monthly reports, analytics dashboards

## Production Features

- **Auto-restart** on crashes
- **Memory monitoring** with automatic restart
- **Log rotation** with timestamps
- **Graceful shutdown** handling
- **Health checks** with minimum uptime
- **Cron-based restarts** for memory cleanup

## Monitoring

PM2 provides built-in monitoring:
- CPU and memory usage
- Restart counts and uptime
- Log aggregation
- Process status

Perfect for production deployments requiring reliable background job processing!