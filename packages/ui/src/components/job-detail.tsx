import type { Job } from "@vorsteh-queue/core"
import { ArrowLeftIcon } from "lucide-react"

import { JobActions } from "@/components/job-actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/queue-utils"

/** Full job data for the detail view. */
export type JobDetailData = Pick<
  Job,
  | "id"
  | "name"
  | "payload"
  | "status"
  | "priority"
  | "attempts"
  | "maxAttempts"
  | "progress"
  | "groupKey"
  | "uniqueKey"
  | "cron"
  | "createdAt"
  | "processedAt"
  | "completedAt"
  | "failedAt"
  | "cancelledAt"
  | "result"
  | "error"
>

interface JobDetailProps {
  /** The job to display. */
  readonly job: JobDetailData
  /** Called when the user clicks the back button. */
  readonly onBack?: () => void
  /** Called when the user cancels the job. */
  readonly onCancel?: () => void
  /** Called when the user retries the job. */
  readonly onRetry?: () => void
  /** Called when the user redrives the job. */
  readonly onRedrive?: () => void
  /** Called when the user triggers "run now". */
  readonly onRunNow?: () => void
  /** Called when the user deletes the job. */
  readonly onDelete?: () => void
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

/**
 * Detailed view of a single job showing metadata, payload, error, and result.
 *
 * @example
 * ```tsx
 * <JobDetail
 *   job={jobData}
 *   onBack={() => router.push("/jobs")}
 *   onRetry={() => retryJob(jobData.id)}
 * />
 * ```
 */
export function JobDetail({
  job,
  onBack,
  onCancel,
  onRetry,
  onRedrive,
  onRunNow,
  onDelete,
}: JobDetailProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {job.id}
          </p>
        </div>

        <JobActions
          status={job.status}
          onCancel={onCancel}
          onRetry={onRetry}
          onRedrive={onRedrive}
          onRunNow={onRunNow}
          onDelete={onDelete}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
            {job.createdAt && (
              <DetailRow
                label="Created"
                value={formatRelativeTime(new Date(job.createdAt))}
              />
            )}
            {job.processedAt && (
              <DetailRow
                label="Processed"
                value={formatRelativeTime(new Date(job.processedAt))}
              />
            )}
            {job.completedAt && (
              <DetailRow
                label="Completed"
                value={formatRelativeTime(new Date(job.completedAt))}
              />
            )}
            {job.failedAt && (
              <DetailRow
                label="Failed"
                value={formatRelativeTime(new Date(job.failedAt))}
              />
            )}
            {job.cancelledAt && (
              <DetailRow
                label="Cancelled"
                value={formatRelativeTime(new Date(job.cancelledAt))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted max-h-64 overflow-auto rounded-md p-4 text-xs">
              {job.payload ? JSON.stringify(job.payload, null, 2) : "null"}
            </pre>
          </CardContent>
        </Card>

        {job.error && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
            </CardContent>
          </Card>
        )}

        {job.result !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted max-h-48 overflow-auto rounded-md p-4 text-xs">
                {JSON.stringify(job.result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
