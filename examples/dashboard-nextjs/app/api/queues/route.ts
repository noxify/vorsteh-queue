import { NextResponse } from "next/server"

import { getQueueClient } from "@/lib/queue-client"

export async function GET() {
  const client = await getQueueClient()
  const names = await client.getQueueNames()
  const defaultName = await client.getDefaultQueueName()
  return NextResponse.json({ names, defaultQueue: defaultName })
}
