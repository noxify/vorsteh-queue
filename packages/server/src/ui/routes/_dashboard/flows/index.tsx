import { queryOptions, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"

import { StatusBadge } from "~/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { request } from "~/lib/api-client"
import { FlowsQuery } from "~/lib/graphql"
import { formatRelativeTime } from "~/lib/utils"

const flowsQueryOptions = queryOptions({
  queryKey: ["flows"],
  queryFn: () => request(FlowsQuery, { limit: 20, offset: 0 }),
  refetchInterval: 10_000,
})

export const Route = createFileRoute("/_dashboard/flows/")({
  component: FlowsPage,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(flowsQueryOptions),
})

function FlowsPage() {
  const { data } = useQuery(flowsQueryOptions)
  const flows = data?.flows ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Flows</h1>
        <p className="text-muted-foreground">Parent-child job trees</p>
      </div>

      {flows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Link
              key={flow.flowId}
              to="/flows/$id"
              // oxlint-disable-next-line typescript/no-non-null-assertion
              params={{ id: flow.flowId! }}
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {flow.rootJob?.name}
                    <StatusBadge status={flow.rootJob?.status ?? "pending"} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <div className="font-mono text-xs">
                      {flow.flowId?.slice(0, 8)}...
                    </div>
                    <div>
                      {flow.rootJob?.createdAt
                        ? formatRelativeTime(new Date(flow.rootJob.createdAt))
                        : "—"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground flex h-64 items-center justify-center">
          No flows found
        </div>
      )}
    </div>
  )
}
