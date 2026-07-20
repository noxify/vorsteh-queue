import { getQueueClient } from "@/lib/queue-client"

import { DlqView } from "./_components/dlq-view"

export default async function DlqPage({
  params,
}: {
  params: Promise<{ queue: string }>
}) {
  const { queue } = await params
  const client = await getQueueClient(queue)
  const deadJobs = await client.getDeadJobs({ limit: 50 })

  return <DlqView initialData={[...deadJobs]} queue={queue} />
}
