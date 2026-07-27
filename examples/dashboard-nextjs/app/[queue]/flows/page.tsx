import { getQueueClient } from "@/lib/queue-client"

import { FlowsView } from "./_components/flows-view"

export default async function FlowsPage({
  params,
}: {
  params: Promise<{ queue: string }>
}) {
  const { queue } = await params
  const client = await getQueueClient(queue)
  const flows = await client.getFlows({ limit: 20 })

  return <FlowsView initialData={[...flows]} queue={queue} />
}
