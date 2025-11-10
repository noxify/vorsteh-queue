"use client"

import * as React from "react"
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
} from "@/components/ui/sidebar"
import { QueueDetails } from "@/types"
import { queuesQueryOptions } from "@/utils/query-options"
import { SiGithub as GithubIcon } from "@icons-pack/react-simple-icons"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { InboxIcon, LayoutDashboardIcon } from "lucide-react"

import { ThemeToggle } from "./theme-toggle"
import { Button } from "./ui/button"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const queuesQuery = useSuspenseQuery(queuesQueryOptions())

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="m-2 flex h-8 shrink-0 items-center space-x-2 font-bold">
              <img
                src="/vorsteh-queue-logo.svg"
                alt="Vorsteh-Queue Logo"
                className="mr-2 inline-block h-8"
              />
              <span className="ml-2 text-xl font-semibold">Vorsteh-Queue</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip={"Dashboard"} asChild>
                  <Link to="/">
                    <div className="flex items-center gap-2">
                      <LayoutDashboardIcon className="size-4" />
                      Dashboard
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarMenu>
              <SidebarGroupLabel>Queues</SidebarGroupLabel>
              {[...queuesQuery.data].map((queue) => {
                return (
                  <SidebarMenuItem key={queue.config.name}>
                    <SidebarMenuButton tooltip={queue.config.name} asChild>
                      <Link to="/queues/$queue" params={{ queue: queue.config.name }}>
                        <div className="flex items-center gap-2">
                          <InboxIcon className="size-4" />
                          {queue.config.name}
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="ml-auto">
          <Button variant="outline" size="icon" className="mr-2" asChild>
            <a href="https://github.com/noxify/vorsteh-queue" target="_blank" rel="noreferrer">
              <GithubIcon />
            </a>
          </Button>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
