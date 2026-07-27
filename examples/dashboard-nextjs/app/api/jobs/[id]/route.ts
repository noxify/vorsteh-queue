import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { getQueueClient } from "@/lib/queue-client"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const queue = request.nextUrl.searchParams.get("queue") ?? undefined
  const client = await getQueueClient(queue)
  const job = await client.getJobById(id)

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  return NextResponse.json(job)
}
