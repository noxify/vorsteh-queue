import Link from "next/link"

import { StatusBadge } from "@/components/status-badge"
import { getQueueClient } from "@/lib/queue-client"
import { formatRelativeTime } from "@/lib/utils"

export default async function FlowsPage() {
  const client = await getQueueClient()
  const flows = await client.getFlows({ limit: 20 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Flows</h1>
        <p className="text-muted-foreground">Parent-child job trees</p>
      </div>

      {flows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Link key={flow.flowId} href={`/flows/${flow.flowId}`}>
              <div className="border-border bg-card hover:border-primary/50 rounded-xl border p-6 shadow-sm transition-colors">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-base font-semibold">
                    {flow.rootJob.name}
                  </span>
                  <StatusBadge status={flow.rootJob.status} />
                </div>
                <div className="text-muted-foreground space-y-1 text-sm">
                  <div className="font-mono text-xs">
                    {flow.flowId.slice(0, 8)}...
                  </div>
                  <div>{formatRelativeTime(flow.rootJob.createdAt)}</div>
                </div>
              </div>
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
