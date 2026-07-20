import { getQueueClient } from "@/lib/queue-client"

import { StatsCards } from "./_components/stats-cards"

export default async function QueueOverviewPage({
  params,
}: {
  params: Promise<{ queue: string }>
}) {
  const { queue } = await params
  const client = await getQueueClient(queue)
  const stats = await client.getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Queue statistics for {queue}</p>
      </div>

      <StatsCards initialData={stats} queue={queue} />
    </div>
  )
}
