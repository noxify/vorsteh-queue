import postgres from "postgres"

/**
 * Create the queue_jobs table directly using raw SQL.
 *
 * TypeORM can use `synchronize: true` to auto-create tables, but for
 * tests we create the table manually to have full control over the schema.
 */
export async function prepareTable(connectionUri: string): Promise<void> {
  const sql = postgres(connectionUri, { max: 1 })

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto CASCADE`

    await sql`
      CREATE TABLE IF NOT EXISTS queue_jobs (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        queue_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        priority INT NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL,
        timeout INT,
        progress INT NOT NULL DEFAULT 0,
        group_key VARCHAR(255),
        unique_key VARCHAR(255),
        cron VARCHAR(255),
        repeat_every INT,
        repeat_limit INT,
        repeat_count INT NOT NULL DEFAULT 0,
        cancellation_reason TEXT,
        depends_on JSONB,
        error JSONB,
        result JSONB,
        steps JSONB,
        signals JSONB,
        on_dependency_failure VARCHAR(10),
        parent_id VARCHAR(255),
        flow_id VARCHAR(255),
        children_count INT NOT NULL DEFAULT 0,
        children_completed INT NOT NULL DEFAULT 0,
        fail_parent_on_failure INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc', now()),
        process_at TIMESTAMPTZ(6) NOT NULL,
        processed_at TIMESTAMPTZ(6),
        completed_at TIMESTAMPTZ(6),
        failed_at TIMESTAMPTZ(6),
        cancelled_at TIMESTAMPTZ(6)
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_polling
        ON queue_jobs (queue_name, status, priority, created_at)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_delayed
        ON queue_jobs (queue_name, process_at)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_active_groups
        ON queue_jobs (queue_name, group_key)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_queue_jobs_stats
        ON queue_jobs (queue_name, status)
    `
  } finally {
    await sql.end()
  }
}
