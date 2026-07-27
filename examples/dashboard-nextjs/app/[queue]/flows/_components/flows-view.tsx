"use client"

import type { FlowSummary } from "@vorsteh-queue/core"
import Link from "next/link"
import { useParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFlows } from "@/hooks/use-queue-data"
import { formatRelativeTime } from "@/lib/utils"

export function FlowsView({
  initialData,
  queue,
}: {
  initialData: FlowSummary[]
  queue: string
}) {
  const params = useParams()
  const currentQueue = (params.queue as string) ?? queue
  const { data: flows } = useFlows(currentQueue, { limit: 20 }, initialData)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Flows</h1>
        <p className="text-muted-foreground">Parent-child job trees</p>
      </div>

      {flows && flows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Link
              key={flow.flowId}
              href={`/${currentQueue}/flows/${flow.flowId}`}
            >
              <Card className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    {flow.rootNode.name}
                    <span className="text-muted-foreground text-xs font-normal">
                      {flow.status}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <div className="font-mono text-xs">
                      {flow.flowId.slice(0, 8)}...
                    </div>
                    <div>{formatRelativeTime(new Date(flow.createdAt))}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground flex h-64 items-center justify-center">
          No flows found
        </div>
      )}
    </div>
  )
}
