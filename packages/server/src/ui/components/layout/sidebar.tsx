import { Link, useRouterState } from "@tanstack/react-router"
import {
  ActivityIcon,
  AlertTriangleIcon,
  GitBranchIcon,
  LayoutDashboardIcon,
  ListIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react"

import { useTheme } from "~/components/theme-provider"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboardIcon },
  { to: "/jobs", label: "Jobs", icon: ListIcon },
  { to: "/dlq", label: "Dead Letter Queue", icon: AlertTriangleIcon },
  { to: "/flows", label: "Flows", icon: GitBranchIcon },
] as const

/**
 * Sidebar navigation component with theme toggle.
 */
export function Sidebar() {
  const { theme, setTheme } = useTheme()
  const router = useRouterState()
  const currentPath = router.location.pathname

  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground flex h-screen w-64 flex-col border-r">
      <div className="border-sidebar-border flex h-14 items-center gap-2 border-b px-4">
        <ActivityIcon className="text-primary h-5 w-5" />
        <span className="text-sm font-semibold">Vorsteh Queue</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.to)

          return (
            <Link
              key={item.to}
              to={item.to}
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

      <div className="border-sidebar-border border-t p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <>
              <SunIcon className="h-4 w-4" />
              Light Mode
            </>
          ) : (
            <>
              <MoonIcon className="h-4 w-4" />
              Dark Mode
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}
