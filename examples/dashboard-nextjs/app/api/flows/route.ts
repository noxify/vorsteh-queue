import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { getQueueClient } from "@/lib/queue-client"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const queue = searchParams.get("queue") ?? undefined
  const limit = Number(searchParams.get("limit") ?? "20")
  const offset = Number(searchParams.get("offset") ?? "0")

  const client = await getQueueClient(queue)
  const flows = await client.getFlows({ limit, offset })

  return NextResponse.json(flows)
}
