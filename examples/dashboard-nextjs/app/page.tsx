import type { QueueStats } from "@vorsteh-queue/core"
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  Loader2Icon,
  PauseCircleIcon,
  SkullIcon,
  XCircleIcon,
} from "lucide-react"

import { getQueueClient } from "@/lib/queue-client"
import { cn } from "@/lib/utils"

const statCards: readonly {
  key: keyof QueueStats
  title: string
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
}[] = [
  {
    key: "pending",
    title: "Pending",
    icon: ClockIcon,
    colorClass: "text-blue-500",
  },
  {
    key: "delayed",
    title: "Delayed",
    icon: PauseCircleIcon,
    colorClass: "text-yellow-500",
  },
  {
    key: "processing",
    title: "Processing",
    icon: Loader2Icon,
    colorClass: "text-purple-500",
  },
  {
    key: "completed",
    title: "Completed",
    icon: CheckCircleIcon,
    colorClass: "text-green-500",
  },
  {
    key: "failed",
    title: "Failed",
    icon: AlertTriangleIcon,
    colorClass: "text-orange-500",
  },
  {
    key: "cancelled",
    title: "Cancelled",
    icon: XCircleIcon,
    colorClass: "text-muted-foreground",
  },
  { key: "dead", title: "Dead", icon: SkullIcon, colorClass: "text-red-500" },
]

export default async function OverviewPage() {
  const client = await getQueueClient()
  const stats = await client.getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Queue statistics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="border-border bg-card text-card-foreground rounded-xl border p-6 shadow-sm"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="text-sm font-medium">{card.title}</span>
              <card.icon className={cn("h-4 w-4", card.colorClass)} />
            </div>
            <div className="text-2xl font-bold">
              {(stats[card.key] ?? 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
