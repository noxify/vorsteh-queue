import type { Job } from "@vorsteh-queue/core"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/queue-utils"

/** Represents a dead letter queue job item. */
export type DlqJobItem = Pick<
  Job,
  "id" | "name" | "attempts" | "maxAttempts" | "failedAt" | "error"
>

interface DlqTableProps {
  /** The list of dead letter queue jobs to render. */
  readonly jobs: readonly DlqJobItem[]
  /** Whether any mutation is currently in progress. */
  readonly isPending?: boolean
  /** Called when the user clicks a job name for navigation. */
  readonly onJobClick?: (jobId: string) => void
  /** Called when the user redrives a single job. */
  readonly onRedrive?: (jobId: string) => void
  /** Called when the user redrives all dead jobs. */
  readonly onRedriveAll?: () => void
}

/**
 * Dead letter queue table showing failed jobs that exceeded max attempts.
 *
 * @example
 * ```tsx
 * <DlqTable
 *   jobs={deadJobs}
 *   onJobClick={(id) => router.push(`/jobs/${id}`)}
 *   onRedrive={(id) => redriveJob(id)}
 *   onRedriveAll={() => redriveAllJobs()}
 * />
 * ```
 */
export function DlqTable({
  jobs,
  isPending = false,
  onJobClick,
  onRedrive,
  onRedriveAll,
}: DlqTableProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Dead Letter Queue
          </h2>
          <p className="text-muted-foreground">
            Jobs that exceeded max attempts
          </p>
        </div>
        {onRedriveAll && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRedriveAll}
            disabled={isPending || jobs.length === 0}
          >
            <RefreshCwIcon className="h-4 w-4" />
            Redrive All
          </Button>
        )}
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
                    <td className="text-muted-foreground max-w-xs truncate px-4 py-3">
                      {job.error?.message ?? "Unknown error"}
                    </td>
                    <td className="px-4 py-3">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {job.failedAt
                        ? formatRelativeTime(new Date(job.failedAt))
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {onRedrive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRedrive(job.id)}
                          disabled={isPending}
                        >
                          <RefreshCwIcon className="h-3 w-3" />
                          Redrive
                        </Button>
                      )}
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
