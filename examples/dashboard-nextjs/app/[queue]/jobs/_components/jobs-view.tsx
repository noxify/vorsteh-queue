"use client"

import type { Job, JobStatus } from "@vorsteh-queue/core"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useQueryStates } from "nuqs"

import { JobActions } from "@/components/job-actions"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useJobs } from "@/hooks/use-queue-data"
import { jobsSearchParams } from "@/lib/search-params"
import { formatRelativeTime } from "@/lib/utils"

const statusOptions: readonly { value: JobStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "delayed", label: "Delayed" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "dead", label: "Dead" },
]

export function JobsView({
  initialData,
  queue,
}: {
  initialData: Job[]
  queue: string
}) {
  const [{ status, name, page }, setParams] = useQueryStates(jobsSearchParams)
  const params = useParams()
  const currentQueue = (params.queue as string) ?? queue
  const limit = 20
  const offset = ((page ?? 1) - 1) * limit

  const { data: jobs } = useJobs(
    currentQueue,
    { status: status ?? undefined, name: name ?? undefined, limit, offset },
    initialData
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">Browse and manage queue jobs</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={status ?? "all"}
          onValueChange={(value) =>
            setParams({
              status: value === "all" ? null : (value as JobStatus),
              page: 1,
            })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Filter by name..."
          defaultValue={name ?? ""}
          className="w-48"
          onChange={(e) => setParams({ name: e.target.value || null, page: 1 })}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs && jobs.length > 0 ? (
              jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      href={`/${currentQueue}/jobs/${job.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {job.name}
                    </Link>
                    <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {job.id.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={job.status} />
                  </TableCell>
                  <TableCell>{job.priority}</TableCell>
                  <TableCell>
                    {job.attempts}/{job.maxAttempts}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="bg-muted h-2 w-16 rounded-full">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {job.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(new Date(job.createdAt))}
                  </TableCell>
                  <TableCell className="text-right">
                    <JobActions
                      jobId={job.id}
                      status={job.status}
                      queue={currentQueue}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-12 text-center"
                >
                  No jobs found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Page {page ?? 1}</p>
        <div className="flex gap-2">
          {(page ?? 1) > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParams({ page: (page ?? 1) - 1 })}
            >
              Previous
            </Button>
          )}
          {jobs && jobs.length >= limit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParams({ page: (page ?? 1) + 1 })}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
