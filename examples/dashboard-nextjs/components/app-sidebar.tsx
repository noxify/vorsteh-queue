"use client"

import {
  ActivityIcon,
  AlertTriangleIcon,
  GitBranchIcon,
  LayoutDashboardIcon,
  ListIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/jobs", label: "Jobs", icon: ListIcon },
  { href: "/dlq", label: "Dead Letter Queue", icon: AlertTriangleIcon },
  { href: "/flows", label: "Flows", icon: GitBranchIcon },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex h-screen w-64 flex-col border-r">
      <div className="border-sidebar-border flex h-14 items-center gap-2 border-b px-4">
        <ActivityIcon className="text-primary h-5 w-5" />
        <span className="text-sm font-semibold">Vorsteh Queue</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
