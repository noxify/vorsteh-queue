import type { JobStatus } from "@vorsteh-queue/core"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusStyles: Record<JobStatus, string> = {
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  delayed:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  processing:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  completed:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-300",
  dead: "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200",
  "waiting-children":
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
}

export function StatusBadge({
  status,
  className,
}: {
  status: JobStatus
  className?: string
}) {
  return <Badge className={cn(statusStyles[status], className)}>{status}</Badge>
}
