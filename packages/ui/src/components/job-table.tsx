import type { Job } from "@vorsteh-queue/core"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { JobActions } from "@/components/job-actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/queue-utils"

/** Represents a job item in the table. */
export type JobTableItem = Pick<
  Job,
  | "id"
  | "name"
  | "status"
  | "priority"
  | "attempts"
  | "maxAttempts"
  | "createdAt"
>

interface JobTableProps {
  /** The list of jobs to render. */
  readonly jobs: readonly JobTableItem[]
  /** Current page number (1-indexed). */
  readonly page: number
  /** Number of items per page (used to determine if "next" is available). */
  readonly pageSize?: number
  /** Called when a job row is clicked for navigation to detail. */
  readonly onJobClick?: (jobId: string) => void
  /** Called when the user navigates to a different page. */
  readonly onPageChange?: (page: number) => void
  /** Called when the user cancels a job. */
  readonly onCancel?: (jobId: string) => void
  /** Called when the user retries a job. */
  readonly onRetry?: (jobId: string) => void
  /** Called when the user redrives a job. */
  readonly onRedrive?: (jobId: string) => void
  /** Called when the user triggers "run now" on a job. */
  readonly onRunNow?: (jobId: string) => void
  /** Called when the user deletes a job. */
  readonly onDelete?: (jobId: string) => void
}

/**
 * A paginated table displaying queue jobs with status, priority, and action controls.
 *
 * @example
 * ```tsx
 * <JobTable
 *   jobs={jobs}
 *   page={1}
 *   onJobClick={(id) => router.push(`/jobs/${id}`)}
 *   onCancel={(id) => cancelJob(id)}
 *   onPageChange={(page) => setPage(page)}
 * />
 * ```
 */
export function JobTable({
  jobs,
  page,
  pageSize = 20,
  onJobClick,
  onPageChange,
  onCancel,
  onRetry,
  onRedrive,
  onRunNow,
  onDelete,
}: JobTableProps) {
  return (
    <div className="space-y-4">
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
                      <button
                        type="button"
                        className="text-primary font-medium hover:underline"
                        onClick={() => onJobClick?.(job.id)}
                      >
                        {job.name}
                      </button>
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
                      {job.createdAt
                        ? formatRelativeTime(new Date(job.createdAt))
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <JobActions
                        status={job.status}
                        onCancel={onCancel ? () => onCancel(job.id) : undefined}
                        onRetry={onRetry ? () => onRetry(job.id) : undefined}
                        onRedrive={
                          onRedrive ? () => onRedrive(job.id) : undefined
                        }
                        onRunNow={onRunNow ? () => onRunNow(job.id) : undefined}
                        onDelete={onDelete ? () => onDelete(job.id) : undefined}
                      />
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
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={jobs.length < pageSize}
            onClick={() => onPageChange?.(page + 1)}
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
