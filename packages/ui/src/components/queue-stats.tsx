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
import { cn } from "@/lib/utils"

interface StatCardProps {
  readonly title: string
  readonly value: number
  readonly icon: React.ComponentType<{ className?: string }>
  readonly colorClass: string
}

function StatCard({ title, value, icon: Icon, colorClass }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", colorClass)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      </CardContent>
    </Card>
  )
}

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

interface QueueStatsProps {
  /** Queue statistics to display. */
  readonly stats: QueueStats
}

/**
 * Displays a grid of stat cards showing queue metrics.
 *
 * @example
 * ```tsx
 * <QueueStatsCards stats={{ pending: 12, delayed: 3, processing: 5, completed: 100, failed: 2, cancelled: 1, dead: 0 }} />
 * ```
 */
export function QueueStatsCards({ stats }: QueueStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {statCards.map((card) => (
        <StatCard
          key={card.key}
          title={card.title}
          value={stats[card.key]}
          icon={card.icon}
          colorClass={card.colorClass}
        />
      ))}
    </div>
  )
}
