import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { getQueueClient } from "@/lib/queue-client"

export async function GET(request: NextRequest) {
  const queue = request.nextUrl.searchParams.get("queue") ?? undefined
  const client = await getQueueClient(queue)
  const stats = await client.getStats()
  return NextResponse.json(stats)
}
