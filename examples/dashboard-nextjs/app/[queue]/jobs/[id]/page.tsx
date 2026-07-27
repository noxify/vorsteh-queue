import { notFound } from "next/navigation"

import { getQueueClient } from "@/lib/queue-client"

import { JobDetailView } from "./_components/job-detail-view"

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ queue: string; id: string }>
}) {
  const { queue, id } = await params
  const client = await getQueueClient(queue)
  const job = await client.getJobById(id)

  if (!job) {
    notFound()
  }

  return <JobDetailView initialData={job} queue={queue} />
}
