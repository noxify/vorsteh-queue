import { queryOptions, useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import type { ResultOf } from "gql.tada"
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  Loader2Icon,
  PauseCircleIcon,
  SkullIcon,
  XCircleIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { request } from "~/lib/api-client"
import { StatsQuery } from "~/lib/graphql"
import { cn } from "~/lib/utils"

type Stats = NonNullable<ResultOf<typeof StatsQuery>["stats"]>

const statsQueryOptions = queryOptions({
  queryKey: ["stats"],
  queryFn: () => request(StatsQuery),
  refetchInterval: 5000,
})

export const Route = createFileRoute("/_dashboard/")({
  component: OverviewPage,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(statsQueryOptions),
})

interface StatCardProps {
  readonly title: string
  readonly value: number
  readonly icon: React.ComponentType<{ className?: string }>
  readonly colorClass: string
}

function StatCard({ title, value, icon: Icon, colorClass }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", colorClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  )
}

const statCards: readonly {
  key: keyof Stats
  title: string
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
}[] = [
  {
    key: "pending",
    title: "Pending",
    icon: ClockIcon,
    colorClass: "text-blue-500",
  },
  {
    key: "delayed",
    title: "Delayed",
    icon: PauseCircleIcon,
    colorClass: "text-yellow-500",
  },
  {
    key: "processing",
    title: "Processing",
    icon: Loader2Icon,
    colorClass: "text-purple-500",
  },
  {
    key: "completed",
    title: "Completed",
    icon: CheckCircleIcon,
    colorClass: "text-green-500",
  },
  {
    key: "failed",
    title: "Failed",
    icon: AlertTriangleIcon,
    colorClass: "text-orange-500",
  },
  {
    key: "cancelled",
    title: "Cancelled",
    icon: XCircleIcon,
    colorClass: "text-muted-foreground",
  },
  { key: "dead", title: "Dead", icon: SkullIcon, colorClass: "text-red-500" },
]

function OverviewPage() {
  const { data } = useQuery(statsQueryOptions)
  const stats = data?.stats

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Queue statistics and throughput</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            title={card.title}
            value={stats?.[card.key] ?? 0}
            icon={card.icon}
            colorClass={card.colorClass}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Throughput</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-64 items-center justify-center">
            Throughput chart — requires time-series data
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
