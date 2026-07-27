import type { SearchParams } from "nuqs/server"

import { getQueueClient } from "@/lib/queue-client"
import { jobsSearchParamsCache } from "@/lib/search-params"

import { JobsView } from "./_components/jobs-view"

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: Promise<{ queue: string }>
  searchParams: Promise<SearchParams>
}) {
  const { queue } = await params
  const { status, name, page } = await jobsSearchParamsCache.parse(searchParams)
  const limit = 20
  const offset = (page - 1) * limit

  const client = await getQueueClient(queue)
  const jobs = await client.getJobs({
    status: status ?? undefined,
    name: name ?? undefined,
    limit,
    offset,
  })

  return <JobsView initialData={[...jobs]} queue={queue} />
}
