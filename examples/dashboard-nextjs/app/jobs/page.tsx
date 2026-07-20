import type { JobStatus } from "@vorsteh-queue/core"
import Link from "next/link"

import { JobActions } from "@/components/job-actions"
import { StatusBadge } from "@/components/status-badge"
import { getQueueClient } from "@/lib/queue-client"
import { formatRelativeTime } from "@/lib/utils"

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; name?: string; page?: string }>
}) {
  const params = await searchParams
  const page = Number(params.page ?? "1")
  const limit = 20
  const offset = (page - 1) * limit

  const client = await getQueueClient()
  const jobs = await client.getJobs({
    status: params.status as JobStatus | undefined,
    name: params.name,
    limit,
    offset,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">Browse and manage queue jobs</p>
      </div>

      <div className="border-border rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border bg-muted/50 border-b">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Priority</th>
                <th className="px-4 py-3 text-left font-medium">Attempts</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map((job) => (
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
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">{job.priority}</td>
                    <td className="px-4 py-3">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {formatRelativeTime(job.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <JobActions jobId={job.id} status={job.status} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-4 py-12 text-center"
                  >
                    No jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Page {page}</p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/jobs?page=${page - 1}`}
              className="border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
            >
              Previous
            </Link>
          )}
          {jobs.length >= limit && (
            <Link
              href={`/jobs?page=${page + 1}`}
              className="border-input hover:bg-accent rounded-md border px-3 py-1.5 text-sm"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
