import type { AvailableStatus, QueueDetails } from "@/types"
import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { RefreshControls } from "@/components/refresh-controls"
import { StatCard } from "@/components/stat-card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { statusColorMap } from "@/utils/colors"
import { queueJobsQueryOptions, queueQueryOptions } from "@/utils/query-options"
import { useSuspenseQueries } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { InfoIcon } from "lucide-react"

export const Route = createFileRoute("/queues/$queue")({
  loader: async ({ context, params: { queue } }) => {
    await context.queryClient.ensureQueryData(queueQueryOptions(queue))
  },
  component: QueuesComponent,
})

function QueuesComponent() {
  const { queue } = Route.useParams()

  const [refreshInterval, setRefreshInterval] = useState(15000) // 15 seconds
  const [isPaused, setIsPaused] = useState(false)

  const [queueQuery, jobsQuery] = useSuspenseQueries({
    queries: [
      queueQueryOptions(queue, {
        enabled: !isPaused,
        refetchInterval: isPaused ? false : refreshInterval,
      }),
      queueJobsQueryOptions(queue, {
        enabled: !isPaused,
        refetchInterval: isPaused ? false : refreshInterval,
      }),
    ],
  })

  const handleRefreshIntervalChange = (interval: number) => {
    setRefreshInterval(interval)
  }

  const handlePauseToggle = (paused: boolean) => {
    setIsPaused(paused)
  }

  const lastUpdatedAt = Math.max(queueQuery.dataUpdatedAt, jobsQuery.dataUpdatedAt) || 0
  const isFetching = queueQuery.isFetching || jobsQuery.isFetching

  return (
    <Container>
      <div className="border-b">
        <div className="flex flex-1 flex-col gap-4 p-8">
          <div>
            <h1 className="text-3xl font-light">Queue: {queueQuery.data.config.name}</h1>
          </div>

          <div className="ml-auto flex gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant={"outline"} className="hover:cursor-pointer">
                  <InfoIcon />
                </Button>
              </SheetTrigger>

              <SheetContent className="md:w-[500px]! md:max-w-full!">
                <QueueInfoSheetContent
                  queueConfig={queueQuery.data.config}
                  queueStats={queueQuery.data.stats}
                />
              </SheetContent>
            </Sheet>
            <RefreshControls
              refreshInterval={refreshInterval}
              setRefreshInterval={handleRefreshIntervalChange}
              isPaused={isPaused}
              setIsPaused={handlePauseToggle}
              lastUpdatedAt={lastUpdatedAt}
              isFetching={isFetching}
              onManualRefresh={() => {
                queueQuery.refetch()
                jobsQuery.refetch()
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-8">
        <dl className="grid grid-cols-2 gap-6 lg:grid-cols-3">
          {Object.entries(queueQuery.data.stats).map(([statName, statValue]) => (
            <StatCard
              key={statName}
              title={statName}
              value={statValue}
              className={cn(
                statusColorMap[statName as AvailableStatus].borderL,
                "border border-l-4",
              )}
            />
          ))}
        </dl>
      </div>
      <div className="space-y-4 p-8">
        <DataTable data={jobsQuery.data} />
      </div>
    </Container>
  )
}

function QueueInfoSheetContent({
  queueConfig,
  queueStats,
}: {
  queueConfig: QueueDetails["config"]
  queueStats: QueueDetails["stats"]
}) {
  const baseConfig = [
    { label: "Queue Name", value: queueConfig.name },
    { label: "Concurrency", value: queueConfig.concurrency },
    { label: "Poll Interval (ms)", value: queueConfig.pollInterval },
    { label: "Job Interval (ms)", value: queueConfig.jobInterval },
  ]

  const jobOptionsConfig = [
    { label: "Default job priority", value: queueConfig.defaultJobOptions?.priority },
    { label: "Default job delay (ms)", value: queueConfig.defaultJobOptions?.delay },
    { label: "Default job max attempts", value: queueConfig.defaultJobOptions?.maxAttempts },
    { label: "Default job timeout (ms)", value: queueConfig.defaultJobOptions?.timeout },
  ]

  const schedulingConfig = [
    { label: "Default job cron", value: queueConfig.defaultJobOptions?.cron },
    { label: "Default job repeat every (ms)", value: queueConfig.defaultJobOptions?.repeat?.every },
    { label: "Default job repeat limit", value: queueConfig.defaultJobOptions?.repeat?.limit },
  ]

  const retryConfig = [
    { label: "Retry delay (ms)", value: queueConfig.retryDelay },
    { label: "Max retry delay (ms)", value: queueConfig.maxRetryDelay },
    { label: "Remove on complete", value: queueConfig.removeOnComplete },
    { label: "Remove on fail", value: queueConfig.removeOnFail },
  ]

  const batchConfig = [
    { label: "Batch min size", value: queueConfig.batch?.minSize },
    { label: "Batch max size", value: queueConfig.batch?.maxSize },
    { label: "Batch wait for (ms)", value: queueConfig.batch?.waitFor },
  ]

  const stats = [
    {
      label: "Pending jobs",
      value: queueStats.pending,
      status: "pending",
    },
    {
      label: "Processing jobs",
      value: queueStats.processing,
      status: "processing",
    },
    {
      label: "Completed jobs",
      value: queueStats.completed,
      status: "completed",
    },
    {
      label: "Failed jobs",
      value: queueStats.failed,
      status: "failed",
    },
    {
      label: "Delayed jobs",
      value: queueStats.delayed,
      status: "delayed",
    },
    // {
    //   label: "Cancelled jobs",
    //   value: queueStats.cancelled,
    //   status: "cancelled",
    // },
  ]

  return (
    <>
      <SheetHeader>
        <SheetTitle>Queue Details: {queueConfig.name}</SheetTitle>
        <SheetDescription>
          Shows the current configuration and the current stats for queue.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto">
        <Accordion type="multiple" defaultValue={["configuration"]} className="px-4">
          <AccordionItem value="baseConfig">
            <AccordionTrigger>Base Configuration</AccordionTrigger>
            <AccordionContent>
              <dl className="divide-y divide-accent">
                {baseConfig.map((item) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 py-2">
                    <dt className="text-sm/6 font-medium">{item.label}</dt>
                    <dd className="mt-0 text-right font-mono text-sm/6">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="baseConfig">
            <AccordionTrigger>Job Options</AccordionTrigger>
            <AccordionContent>
              <dl className="divide-y divide-accent">
                {jobOptionsConfig.map((item) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 py-2">
                    <dt className="text-sm/6 font-medium">{item.label}</dt>
                    <dd className="mt-0 text-right font-mono text-sm/6">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="baseConfig">
            <AccordionTrigger>Scheduling Configuration</AccordionTrigger>
            <AccordionContent>
              <dl className="divide-y divide-accent">
                {schedulingConfig.map((item) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 py-2">
                    <dt className="text-sm/6 font-medium">{item.label}</dt>
                    <dd className="mt-0 text-right font-mono text-sm/6">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="baseConfig">
            <AccordionTrigger>Retry Configuration</AccordionTrigger>
            <AccordionContent>
              <dl className="divide-y divide-accent">
                {retryConfig.map((item) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 py-2">
                    <dt className="text-sm/6 font-medium">{item.label}</dt>
                    <dd className="mt-0 text-right font-mono text-sm/6">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="baseConfig">
            <AccordionTrigger>Batch Configuration</AccordionTrigger>
            <AccordionContent>
              <dl className="divide-y divide-accent">
                {batchConfig.map((item) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 py-2">
                    <dt className="text-sm/6 font-medium">{item.label}</dt>
                    <dd className="mt-0 text-right font-mono text-sm/6">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="stats">
            <AccordionTrigger>Job Stats</AccordionTrigger>
            <AccordionContent>
              <dl className="divide-y divide-accent">
                {stats.map((item) => (
                  <div key={item.label} className="grid grid-cols-2 gap-4 py-2">
                    <dt className="text-sm/6 font-medium">
                      <div className="flex">
                        <div className="relative inline-flex items-center justify-center gap-x-3">
                          <div
                            className={cn(
                              "h-2 w-2 rounded-full",
                              statusColorMap[item.status as AvailableStatus].bg,
                            )}
                          />
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            {item.label}
                          </span>
                        </div>
                      </div>
                    </dt>
                    <dd className="mt-0 text-right font-mono text-sm/6">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </>
  )
}
