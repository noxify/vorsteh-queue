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
  const tree = await client.getFlowTree(id)

  if (!tree) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 })
  }

  return NextResponse.json(tree)
}
