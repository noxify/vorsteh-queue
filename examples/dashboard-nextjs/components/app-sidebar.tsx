"use client"

import {
  ActivityIcon,
  AlertTriangleIcon,
  GitBranchIcon,
  LayoutDashboardIcon,
  ListIcon,
  PieChartIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"

import { QueueSelector } from "@/components/queue-selector"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const queueNavItems = [
  { path: "", label: "Overview", icon: PieChartIcon },
  { path: "/jobs", label: "Jobs", icon: ListIcon },
  { path: "/dlq", label: "Dead Letter Queue", icon: AlertTriangleIcon },
  { path: "/flows", label: "Flows", icon: GitBranchIcon },
] as const

export function AppSidebar() {
  const pathname = usePathname()
  const params = useParams()
  const currentQueue = params.queue as string | undefined

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <ActivityIcon className="text-primary h-5 w-5" />
          <span className="text-sm font-semibold">Vorsteh Queue</span>
        </div>
        <div className="px-2 pb-1">
          <QueueSelector />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/" />}
                  isActive={pathname === "/"}
                >
                  <LayoutDashboardIcon />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {currentQueue && (
          <SidebarGroup>
            <SidebarGroupLabel>Queue Details</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {queueNavItems.map((item) => {
                  const href = `/${currentQueue}${item.path}`
                  const isActive =
                    item.path === ""
                      ? pathname === `/${currentQueue}`
                      : pathname.startsWith(href)

                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        render={<Link href={href} />}
                        isActive={isActive}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
      </SidebarFooter>
    </Sidebar>
  )
}
