"use client"

import type * as React from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar"

// Dummy data for documentation navigation
const docsNav = [
  {
    title: "Getting Started",
    links: [
      { href: "/docs/introduction", label: "Introduction" },
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "Core Concepts",
    links: [
      { href: "/docs/jobs", label: "Jobs" },
      { href: "/docs/queues", label: "Queues" },
      { href: "/docs/workers", label: "Workers" },
      { href: "/docs/adapters", label: "Database Adapters" },
    ],
  },
  {
    title: "Examples",
    links: [
      { href: "/docs/example-email", label: "Email Sending" },
      { href: "/docs/example-image-processing", label: "Image Processing" },
      { href: "/docs/example-notifications", label: "Notifications" },
    ],
  },
  {
    title: "API Reference",
    links: [
      { href: "/docs/api-queue", label: "VorstehQueue API" },
      { href: "/docs/api-job", label: "Job API" },
      { href: "/docs/api-options", label: "Options" },
    ],
  },
]

export function DocsSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarContent>
        {docsNav.map((group) => (
          <Collapsible key={group.title} defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between">
                  {group.title}
                  <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.links.map((link) => (
                      <SidebarMenuItem key={link.href}>
                        <SidebarMenuButton asChild>
                          <Link href={link.href}>{link.label}</Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
