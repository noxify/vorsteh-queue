import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  // The docs shell (sidebar, header, TOC rail) is rendered by the segment layout.
  // Keep the loading UI limited to the page content to avoid duplicate sidebars.
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[96%]" />
        <Skeleton className="h-4 w-[92%]" />
        <Skeleton className="h-4 w-[88%]" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[94%]" />
        <Skeleton className="h-4 w-[90%]" />
      </div>
    </div>
  )
}
