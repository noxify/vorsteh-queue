import { notFound } from "next/navigation"

import { getQueueClient } from "@/lib/queue-client"

import { FlowDetailView } from "./_components/flow-detail-view"

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ queue: string; id: string }>
}) {
  const { queue, id } = await params
  const client = await getQueueClient(queue)
  const tree = await client.getFlowTree(id)

  if (!tree) {
    notFound()
  }

  return <FlowDetailView flowId={id} initialData={tree} queue={queue} />
}
