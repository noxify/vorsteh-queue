"use client"

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Breadcrumbs({ queue }: { queue: string }) {
  const pathname = usePathname()

  // Extract the sub-path after /[queue]/
  const segments = pathname.split("/").filter(Boolean)
  const subSegments = segments.slice(1) // Remove the queue segment

  const crumbs = [
    { label: queue, href: `/${queue}` },
    ...subSegments.map((segment, index) => ({
      label: formatSegment(segment),
      href: `/${queue}/${subSegments.slice(0, index + 1).join("/")}`,
    })),
  ]

  return (
    <nav className="text-muted-foreground flex items-center gap-1 text-sm">
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {index > 0 && <ChevronRightIcon className="h-3 w-3" />}
          {index === crumbs.length - 1 ? (
            <span className="text-foreground font-medium">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

function formatSegment(segment: string): string {
  if (segment === "dlq") {
    return "Dead Letter Queue"
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}
