import type { VariantProps } from "class-variance-authority"

import type { badgeVariants } from "~/components/ui/badge"
import { Badge } from "~/components/ui/badge"

const statusVariantMap: Record<
  string,
  VariantProps<typeof badgeVariants>["variant"]
> = {
  pending: "info",
  delayed: "warning",
  processing: "default",
  completed: "success",
  failed: "destructive",
  cancelled: "secondary",
  dead: "destructive",
  "waiting-children": "info",
}

/**
 * Displays a colored badge for a job status.
 */
export function StatusBadge({ status }: { readonly status: string }) {
  return (
    <Badge variant={statusVariantMap[status] ?? "secondary"}>{status}</Badge>
  )
}
