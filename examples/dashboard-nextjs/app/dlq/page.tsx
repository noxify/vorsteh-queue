import Link from "next/link"

import { RedriveAllButton } from "@/components/redrive-all-button"
import { RedriveButton } from "@/components/redrive-button"
import { getQueueClient } from "@/lib/queue-client"
import { formatRelativeTime } from "@/lib/utils"

export default async function DlqPage() {
  const client = await getQueueClient()
  const deadJobs = await client.getDeadJobs({ limit: 50 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dead Letter Queue
          </h1>
          <p className="text-muted-foreground">
            Jobs that exceeded max attempts
          </p>
        </div>
        <RedriveAllButton disabled={deadJobs.length === 0} />
      </div>

      <div className="border-border rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Error</th>
                <th className="px-4 py-3 text-left font-medium">Attempts</th>
                <th className="px-4 py-3 text-left font-medium">Failed At</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deadJobs.length > 0 ? (
                deadJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-border hover:bg-muted/30 border-b last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/jobs/${job.id}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {job.name}
                      </Link>
                      <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                        {job.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="text-muted-foreground max-w-xs truncate px-4 py-3">
                      {job.error?.message ?? "Unknown error"}
                    </td>
                    <td className="px-4 py-3">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {job.failedAt
                        ? formatRelativeTime(job.failedAt)
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RedriveButton jobId={job.id} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground px-4 py-12 text-center"
                  >
                    No dead jobs — everything is healthy
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
