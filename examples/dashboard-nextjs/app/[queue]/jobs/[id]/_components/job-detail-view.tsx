"use client"

import type { Job } from "@vorsteh-queue/core"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

import { JobActions } from "@/components/job-actions"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useJob } from "@/hooks/use-queue-data"
import { formatRelativeTime } from "@/lib/utils"

export function JobDetailView({
  initialData,
  queue,
}: {
  initialData: Job
  queue: string
}) {
  const { data: job } = useJob(queue, initialData.id, initialData)
  if (!job) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/${queue}/jobs`}
          className="hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-lg"
        >
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
        <JobActions jobId={job.id} status={job.status} queue={queue} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JobDetailsCard job={job} queue={queue} />
        <JobTimestampsCard job={job} />
        <JobProgressCard progress={job.progress} />
        <JobPayloadCard payload={job.payload} />
        {job.error && <JobErrorCard error={job.error} />}
        {job.result !== undefined && <JobResultCard result={job.result} />}
        {job.steps && job.steps.length > 0 && (
          <JobStepsCard steps={job.steps} />
        )}
      </div>
    </div>
  )
}

function JobDetailsCard({ job, queue }: { job: Job; queue: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <DetailRow label="Status" value={job.status} />
        <DetailRow label="Priority" value={String(job.priority)} />
        <DetailRow
          label="Attempts"
          value={`${job.attempts} / ${job.maxAttempts}`}
        />
        {job.groupKey && <DetailRow label="Group" value={job.groupKey} />}
        {job.uniqueKey && (
          <DetailRow label="Unique Key" value={job.uniqueKey} />
        )}
        {job.cron && <DetailRow label="Cron" value={job.cron} />}
        {job.repeatEvery && (
          <DetailRow label="Repeat Every" value={`${job.repeatEvery}ms`} />
        )}
        {job.repeatLimit && (
          <DetailRow label="Repeat Limit" value={String(job.repeatLimit)} />
        )}
        {job.repeatCount > 0 && (
          <DetailRow label="Repeat Count" value={String(job.repeatCount)} />
        )}
        {job.timeout !== undefined && (
          <DetailRow
            label="Timeout"
            value={job.timeout === false ? "disabled" : `${job.timeout}ms`}
          />
        )}
        {job.cancellationReason && (
          <DetailRow label="Cancel Reason" value={job.cancellationReason} />
        )}
        {job.flowNodeId && (
          <DetailRow
            label="Flow Node"
            value={job.flowNodeId}
            href={`/${queue}/flows`}
          />
        )}
      </CardContent>
    </Card>
  )
}

function JobTimestampsCard({ job }: { job: Job }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Timestamps</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <DetailRow
          label="Created"
          value={formatRelativeTime(new Date(job.createdAt))}
        />
        <DetailRow
          label="Scheduled"
          value={formatRelativeTime(new Date(job.processAt))}
        />
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
  )
}

function JobProgressCard({ progress }: { progress: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="bg-muted h-3 flex-1 rounded-full">
            <div
              className="bg-primary h-3 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{progress}%</span>
        </div>
      </CardContent>
    </Card>
  )
}

function JobPayloadCard({ payload }: { payload: unknown }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payload</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-4 text-xs">
          {payload ? JSON.stringify(payload, null, 2) : "null"}
        </pre>
      </CardContent>
    </Card>
  )
}

function JobErrorCard({
  error,
}: {
  error: { name: string; message: string; stack?: string }
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-destructive">Error</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="font-mono text-sm font-medium">{error.name}</div>
        <div className="text-muted-foreground text-sm">{error.message}</div>
        {error.stack && (
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
            {error.stack}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}

function JobResultCard({ result }: { result: unknown }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Result</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted max-h-48 overflow-auto rounded-md p-4 text-xs">
          {JSON.stringify(result, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

function JobStepsCard({
  steps,
}: {
  steps: readonly { name: string; status: string }[]
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Steps</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={`${step.name}-${index}`}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <StepStatusDot status={step.status} />
                <span className="text-sm font-medium">{step.name}</span>
              </div>
              <span className="text-muted-foreground text-xs">
                {step.status}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      {href ? (
        <Link
          href={href}
          className="text-primary text-sm font-medium hover:underline"
        >
          {value}
        </Link>
      ) : (
        <span className="text-sm font-medium">{value}</span>
      )}
    </div>
  )
}

function StepStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-500",
    running: "bg-purple-500",
    failed: "bg-red-500",
    pending: "bg-gray-400",
    waiting: "bg-blue-500",
  }

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[status] ?? "bg-gray-400"}`}
    />
  )
}
