import { queryOptions, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { z } from "zod"

import { JobActions } from "~/components/job-actions"
import { StatusBadge } from "~/components/status-badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  Select,
  SelectItem,
  SelectPositioner,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { request } from "~/lib/api-client"
import { JobsQuery } from "~/lib/graphql"
import { formatRelativeTime } from "~/lib/utils"

const jobsSearchSchema = z.object({
  status: z
    .enum([
      "pending",
      "delayed",
      "processing",
      "completed",
      "failed",
      "cancelled",
      "dead",
    ])
    .optional(),
  name: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
})

type JobsSearch = z.infer<typeof jobsSearchSchema>

function jobsQueryOptions(search: JobsSearch) {
  const limit = 20
  const offset = (search.page - 1) * limit

  return queryOptions({
    queryKey: ["jobs", search],
    queryFn: () =>
      request(JobsQuery, {
        status: search.status ?? null,
        name: search.name ?? null,
        limit,
        offset,
      }),
    refetchInterval: 10_000,
  })
}

export const Route = createFileRoute("/_dashboard/jobs/")({
  component: JobsPage,
  validateSearch: jobsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(jobsQueryOptions(deps)),
})

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "delayed", label: "Delayed" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "dead", label: "Dead" },
] as const

function JobsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data } = useQuery(jobsQueryOptions(search))
  const jobs = data?.jobs ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">Browse and manage queue jobs</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={search.status ?? ""}
          onValueChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                status: (value || undefined) as JobsSearch["status"],
                page: 1,
              }),
            })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectPositioner>
            <SelectItem value="">All statuses</SelectItem>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectPositioner>
        </Select>

        <Input
          placeholder="Filter by name..."
          defaultValue={search.name ?? ""}
          className="w-48"
          onChange={(event) => {
            const { value } = event.target
            navigate({
              search: (prev) => ({
                ...prev,
                name: value || undefined,
                page: 1,
              }),
            })
          }}
        />
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
                        to="/jobs/$id"
                        // oxlint-disable-next-line typescript/no-non-null-assertion
                        params={{ id: job.id! }}
                        className="text-primary font-medium hover:underline"
                      >
                        {job.name}
                      </Link>
                      <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                        {job.id?.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status ?? "pending"} />
                    </td>
                    <td className="px-4 py-3">{job.priority}</td>
                    <td className="px-4 py-3">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {job.createdAt
                        ? formatRelativeTime(new Date(job.createdAt))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <JobActions
                        // oxlint-disable-next-line typescript/no-non-null-assertion
                        jobId={job.id!}
                        status={job.status ?? "pending"}
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
        <p className="text-muted-foreground text-sm">Page {search.page}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={search.page <= 1}
            onClick={() =>
              navigate({
                search: (prev) => ({ ...prev, page: prev.page - 1 }),
              })
            }
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={jobs.length < 20}
            onClick={() =>
              navigate({
                search: (prev) => ({ ...prev, page: prev.page + 1 }),
              })
            }
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
