import postgres from "postgres"

/**
 * Create the queue_jobs and queue_flows tables directly using raw SQL.
 *
 * MikroORM can use SchemaGenerator to auto-create tables, but for
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
        error JSONB,
        result JSONB,
        steps JSONB,
        signals JSONB,
        flow_node_id VARCHAR(255),
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

    await sql`
      CREATE TABLE IF NOT EXISTS queue_flows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flow_id UUID NOT NULL,
        parent_node_id UUID,
        job_id UUID,
        queue_name VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        options JSONB,
        status VARCHAR(50) NOT NULL,
        failure_strategy VARCHAR(20) NOT NULL DEFAULT 'default',
        children_count INT NOT NULL DEFAULT 0,
        children_completed INT NOT NULL DEFAULT 0,
        result JSONB,
        error JSONB,
        created_at TIMESTAMPTZ(6) NOT NULL DEFAULT timezone('utc', now()),
        completed_at TIMESTAMPTZ(6)
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_queue_flows_flow_id ON queue_flows (flow_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_queue_flows_parent_node_id ON queue_flows (parent_node_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_queue_flows_job_id ON queue_flows (job_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_queue_flows_status ON queue_flows (flow_id, status)`
  } finally {
    await sql.end()
  }
}
