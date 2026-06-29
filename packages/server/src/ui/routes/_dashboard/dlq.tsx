import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "~/components/ui/button"
import { request } from "~/lib/api-client"
import {
  DeadJobsQuery,
  RedriveAllMutation,
  RedriveJobMutation,
} from "~/lib/graphql"
import { formatRelativeTime } from "~/lib/utils"

const dlqQueryOptions = queryOptions({
  queryKey: ["dead-jobs"],
  queryFn: () => request(DeadJobsQuery, { limit: 50, offset: 0 }),
  refetchInterval: 10_000,
})

export const Route = createFileRoute("/_dashboard/dlq")({
  component: DlqPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(dlqQueryOptions),
})

function DlqPage() {
  const { data } = useQuery(dlqQueryOptions)
  const deadJobs = data?.deadJobs ?? []
  const queryClient = useQueryClient()

  const redriveMutation = useMutation({
    mutationFn: (id: string) => request(RedriveJobMutation, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dead-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })

  const redriveAllMutation = useMutation({
    mutationFn: () => request(RedriveAllMutation, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dead-jobs"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
    },
  })

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
        <Button
          variant="outline"
          size="sm"
          onClick={() => redriveAllMutation.mutate()}
          disabled={redriveAllMutation.isPending || deadJobs.length === 0}
        >
          <RefreshCwIcon className="h-4 w-4" />
          Redrive All
        </Button>
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
                    <td className="text-muted-foreground max-w-xs truncate px-4 py-3">
                      {job.error?.message ?? "Unknown error"}
                    </td>
                    <td className="px-4 py-3">
                      {job.attempts}/{job.maxAttempts}
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {job.failedAt
                        ? formatRelativeTime(new Date(job.failedAt))
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        // oxlint-disable-next-line typescript/no-non-null-assertion
                        onClick={() => redriveMutation.mutate(job.id!)}
                        disabled={redriveMutation.isPending}
                      >
                        <RefreshCwIcon className="h-3 w-3" />
                        Redrive
                      </Button>
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
