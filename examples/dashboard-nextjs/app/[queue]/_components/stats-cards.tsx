"use client"

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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useStats } from "@/hooks/use-queue-data"
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

export function StatsCards({
  initialData,
  queue,
}: {
  initialData: QueueStats
  queue: string
}) {
  const { data: stats } = useStats(queue, initialData)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {statCards.map((card) => (
        <Card key={card.key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={cn("h-4 w-4", card.colorClass)} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.[card.key] ?? 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
