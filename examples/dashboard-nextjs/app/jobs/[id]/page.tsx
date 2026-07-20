import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { JobActions } from "@/components/job-actions"
import { StatusBadge } from "@/components/status-badge"
import { getQueueClient } from "@/lib/queue-client"
import { formatRelativeTime } from "@/lib/utils"

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getQueueClient()
  const job = await client.getJobById(id)

  if (!job) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/jobs" className="hover:bg-accent rounded-md p-2">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {job.id}
          </p>
        </div>
        <JobActions jobId={job.id} status={job.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Details</h2>
          <div className="space-y-3">
            <DetailRow label="Priority" value={String(job.priority)} />
            <DetailRow
              label="Attempts"
              value={`${job.attempts} / ${job.maxAttempts}`}
            />
            <DetailRow label="Progress" value={`${job.progress}%`} />
            {job.groupKey && <DetailRow label="Group" value={job.groupKey} />}
            {job.uniqueKey && (
              <DetailRow label="Unique Key" value={job.uniqueKey} />
            )}
            {job.cron && <DetailRow label="Cron" value={job.cron} />}
            <DetailRow
              label="Created"
              value={formatRelativeTime(job.createdAt)}
            />
            {job.processedAt && (
              <DetailRow
                label="Processed"
                value={formatRelativeTime(job.processedAt)}
              />
            )}
            {job.completedAt && (
              <DetailRow
                label="Completed"
                value={formatRelativeTime(job.completedAt)}
              />
            )}
            {job.failedAt && (
              <DetailRow
                label="Failed"
                value={formatRelativeTime(job.failedAt)}
              />
            )}
            {job.cancelledAt && (
              <DetailRow
                label="Cancelled"
                value={formatRelativeTime(job.cancelledAt)}
              />
            )}
          </div>
        </div>

        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">Payload</h2>
          <pre className="bg-muted max-h-64 overflow-auto rounded-md p-4 text-xs">
            {job.payload ? JSON.stringify(job.payload, null, 2) : "null"}
          </pre>
        </div>

        {job.error && (
          <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="text-destructive mb-4 font-semibold">Error</h2>
            <div className="space-y-2">
              <div className="font-mono text-sm font-medium">
                {job.error.name}
              </div>
              <div className="text-muted-foreground text-sm">
                {job.error.message}
              </div>
              {job.error.stack && (
                <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
                  {job.error.stack}
                </pre>
              )}
            </div>
          </div>
        )}

        {job.result !== undefined && (
          <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
            <h2 className="mb-4 font-semibold">Result</h2>
            <pre className="bg-muted max-h-48 overflow-auto rounded-md p-4 text-xs">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
