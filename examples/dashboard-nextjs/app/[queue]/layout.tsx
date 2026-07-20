import { notFound } from "next/navigation"

import { Breadcrumbs } from "@/components/breadcrumbs"
import { getQueueClient } from "@/lib/queue-client"

export default async function QueueLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ queue: string }>
}) {
  const { queue } = await params

  // Validate that the queue name exists (also prevents matching static files like favicon.ico)
  const client = await getQueueClient()
  const queueNames = await client.getQueueNames()
  if (!queueNames.includes(queue)) {
    notFound()
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs queue={queue} />
      {children}
    </div>
  )
}
