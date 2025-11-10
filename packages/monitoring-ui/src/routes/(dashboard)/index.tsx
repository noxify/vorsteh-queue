import type { AvailableStatus } from "@/types"
import { useState } from "react"
import { RefreshControls } from "@/components/refresh-controls"
import { StatCard } from "@/components/stat-card"
import { cn } from "@/lib/utils"
import { statusColorMap } from "@/utils/colors"
import { overviewQueryOptions } from "@/utils/query-options"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(dashboard)/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(overviewQueryOptions())
  },
  component: DashboardPage,
})

function DashboardPage() {
  const [refreshInterval, setRefreshInterval] = useState(15000) // 15 seconds
  const [isPaused, setIsPaused] = useState(false)

  const query = useSuspenseQuery(
    overviewQueryOptions({
      enabled: !isPaused,
      refetchInterval: isPaused ? false : refreshInterval,
    }),
  )

  const handleRefreshIntervalChange = (interval: number) => {
    setRefreshInterval(interval)
  }

  const handlePauseToggle = (paused: boolean) => {
    setIsPaused(paused)
  }

  const lastUpdatedAt = Math.max(query.dataUpdatedAt ?? 0, query.dataUpdatedAt ?? 0) ?? 0
  const isFetching = query.isFetching
  const isLoading = query.isLoading

  const data = [
    { name: "Queues", stat: query.data.queues },
    {
      name: "Pending jobs",
      stat: query.data.pending,
      status: "pending" as AvailableStatus,
    },
    {
      name: "Running jobs",
      stat: query.data.processing,
      status: "processing" as AvailableStatus,
    },
    {
      name: "Completed jobs",
      stat: query.data.completed,
      status: "completed" as AvailableStatus,
    },
    {
      name: "Failed jobs",
      stat: query.data.failed,
      status: "failed" as AvailableStatus,
    },
    {
      name: "Delayed jobs",
      stat: query.data.delayed,
      status: "delayed" as AvailableStatus,
    },
    // {
    //   name: "Cancelled jobs",
    //   stat: query.data.cancelled,
    //   status: "cancelled" as AvailableStatus,
    // },
  ]
  return (
    <>
      <div className="border-b">
        <div className="flex flex-1 flex-col gap-4 p-8 md:flex-row md:justify-between">
          <div>
            <h1 className="text-4xl font-light">Monitoring Dashboard</h1>
          </div>

          <RefreshControls
            refreshInterval={refreshInterval}
            setRefreshInterval={handleRefreshIntervalChange}
            isPaused={isPaused}
            setIsPaused={handlePauseToggle}
            lastUpdatedAt={lastUpdatedAt}
            isFetching={isFetching}
            onManualRefresh={() => {
              query.refetch()
            }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-8">
        {isLoading ? (
          <>Loading...</>
        ) : (
          <dl className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {data.map((item) => (
              <StatCard
                key={item.name}
                title={item.name}
                value={item.stat}
                className={cn(
                  statusColorMap[item.status as AvailableStatus]?.borderL ?? "border-l-primary",
                  "border border-l-4",
                )}
              />
            ))}
          </dl>
        )}
      </div>
    </>
  )
}
