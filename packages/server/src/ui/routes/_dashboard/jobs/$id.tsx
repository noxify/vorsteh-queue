import { queryOptions, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"

import { JobActions } from "~/components/job-actions"
import { StatusBadge } from "~/components/status-badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { request } from "~/lib/api-client"
import { JobDetailQuery } from "~/lib/graphql"
import { formatRelativeTime } from "~/lib/utils"

function jobQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["job", id],
    queryFn: () => request(JobDetailQuery, { id }),
    refetchInterval: 5000,
  })
}

export const Route = createFileRoute("/_dashboard/jobs/$id")({
  component: JobDetailPage,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(jobQueryOptions(params.id)),
})

function JobDetailPage() {
  const { id } = Route.useParams()
  const { data } = useQuery(jobQueryOptions(id))
  const job = data?.job

  if (!job) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center">
        Job not found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/jobs">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <StatusBadge status={job.status ?? "pending"} />
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {job.id}
          </p>
        </div>

        <JobActions
          jobId={
            // oxlint-disable-next-line typescript/no-non-null-assertion
            job.id!
          }
          status={job.status ?? "pending"}
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
              {job.payload
                ? JSON.stringify(JSON.parse(job.payload), null, 2)
                : "null"}
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

        {job.result && (
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted max-h-48 overflow-auto rounded-md p-4 text-xs">
                {JSON.stringify(JSON.parse(job.result), null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
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
