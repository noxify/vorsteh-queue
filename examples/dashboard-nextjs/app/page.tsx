import type { QueueStats } from "@vorsteh-queue/core"

import { getQueueClient } from "@/lib/queue-client"

import { DashboardView } from "./_components/dashboard-view"

export default async function DashboardPage() {
  const client = await getQueueClient()
  const queueNames = await client.getQueueNames()

  // Fetch stats sequentially to avoid connection pool contention
  const queuesData: { name: string; stats: QueueStats }[] = []
  for (const name of queueNames) {
    const queueClient = await getQueueClient(name)
    const stats = await queueClient.getStats()
    queuesData.push({ name, stats })
  }

  return <DashboardView queues={queuesData} />
}
