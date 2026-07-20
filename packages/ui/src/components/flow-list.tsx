import type { JobStatus } from "@vorsteh-queue/core"

import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatRelativeTime } from "@/lib/queue-utils"

/** Represents a flow summary item. */
export interface FlowListItem {
  /** Unique flow identifier. */
  readonly flowId: string
  /** Root job name. */
  readonly rootJobName: string
  /** Root job status. */
  readonly rootJobStatus: JobStatus
  /** Root job creation timestamp. */
  readonly createdAt: string | null
}

interface FlowListProps {
  /** The list of flows to render. */
  readonly flows: readonly FlowListItem[]
  /** Called when the user clicks a flow card for navigation. */
  readonly onFlowClick?: (flowId: string) => void
}

/**
 * Card grid displaying flow (parent-child job tree) summaries.
 *
 * @example
 * ```tsx
 * <FlowList
 *   flows={flows}
 *   onFlowClick={(id) => router.push(`/flows/${id}`)}
 * />
 * ```
 */
export function FlowList({ flows, onFlowClick }: FlowListProps) {
  if (flows.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center">
        No flows found
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {flows.map((flow) => (
        <button
          key={flow.flowId}
          type="button"
          className="text-left"
          onClick={() => onFlowClick?.(flow.flowId)}
        >
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-base">
                {flow.rootJobName}
                <StatusBadge status={flow.rootJobStatus} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground space-y-1 text-sm">
                <div className="font-mono text-xs">
                  {flow.flowId.slice(0, 8)}...
                </div>
                <div>
                  {flow.createdAt
                    ? formatRelativeTime(new Date(flow.createdAt))
                    : "\u2014"}
                </div>
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  )
}
