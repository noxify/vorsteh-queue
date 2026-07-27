"use client"

import { SiGithub as Github } from "@icons-pack/react-simple-icons"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import {
  SidebarMenu,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import type { NavigationGroup, TreeItem } from "@/lib/navigation"
import { cn } from "@/lib/utils"

import { VorstehQueueLogo } from "./logo"
import PlatformModifierKey from "./platform-modifier-key"
import { SearchCommand } from "./search-command"
import { SidebarItem } from "./sidebar-item"
import ThemeToggle from "./theme-toggle"
import { buttonVariants } from "./ui/button"
import { Item, ItemActions, ItemContent, ItemTitle } from "./ui/item"
import { Kbd } from "./ui/kbd"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

export function DocsSidebar({
  className,
  collectionChooser,
  favoriteItems,
  navigationItems,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  collectionChooser?: React.ReactNode
  favoriteItems?: TreeItem[]
  navigationItems?: NavigationGroup[]
}) {
  const pathname = usePathname()
  const quickLinks = favoriteItems ?? []
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null)
  const navigationContainerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const scrollContainerElement = scrollContainerRef.current
    const navigationContainerElement = navigationContainerRef.current

    if (!scrollContainerElement || !navigationContainerElement) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const activeElements = [
        ...navigationContainerElement.querySelectorAll<HTMLElement>(
          "[data-active]"
        ),
      ]
      const targetElement = activeElements.at(-1)

      if (!targetElement) {
        return
      }

      const containerRect = scrollContainerElement.getBoundingClientRect()
      const targetRect = targetElement.getBoundingClientRect()
      const isAboveViewport = targetRect.top < containerRect.top
      const isBelowViewport = targetRect.bottom > containerRect.bottom

      if (!isAboveViewport && !isBelowViewport) {
        return
      }

      const targetTop =
        targetRect.top - containerRect.top + scrollContainerElement.scrollTop
      const nextScrollTop =
        targetTop -
        scrollContainerElement.clientHeight / 2 +
        targetRect.height / 2

      scrollContainerElement.scrollTo({ top: nextScrollTop })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [pathname])

  return (
    <Sidebar
      variant="sidebar"
      className={cn(
        "group-data-[collapsible=offcanvas]:border-r-0!",
        className
      )}
      {...props}
    >
      <SidebarHeader className="p-4 group-data-[collapsible=offcanvas]:hidden">
        <div className="flex items-center justify-between">
          <Link href="/" prefetch={false} className="flex items-center gap-3">
            <VorstehQueueLogo className="size-10" />

            <div
              className="text-foreground leading-none font-bold"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              Vorsteh Queue
            </div>
          </Link>
          <div>
            <Tooltip>
              <TooltipTrigger
                render={<SidebarTrigger className="cursor-pointer" />}
              />
              <TooltipContent>
                Toggle sidebar{" "}
                <Kbd>
                  <PlatformModifierKey />B
                </Kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <SearchCommand>
          <Item
            size="xs"
            variant="outline"
            className="bg-background cursor-pointer"
            render={<button type="button" />}
          >
            <ItemContent className="gap-0">
              <ItemTitle>Search...</ItemTitle>
            </ItemContent>
            <ItemActions>
              <Kbd>
                <PlatformModifierKey />K
              </Kbd>
            </ItemActions>
          </Item>
        </SearchCommand>

        {collectionChooser}
      </SidebarHeader>

      <SidebarContent
        ref={scrollContainerRef}
        className="gap-0 p-4 group-data-[collapsible=offcanvas]:hidden"
      >
        {quickLinks.length > 0 && (
          <SidebarGroup className="px-0">
            <SidebarGroupLabel>Quick Links</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {quickLinks.map((item) => (
                  <SidebarItem key={item.url} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div ref={navigationContainerRef}>
          {(navigationItems ?? []).map((group, groupIdx) => (
            <SidebarGroup key={group.label + groupIdx} className="px-0">
              {group.label && (
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarItem key={item.url} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=offcanvas]:hidden">
        <div className="flex items-center justify-end">
          <div>
            <a
              href="https://github.com/noxify/vorsteh-queue"
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ size: "icon", variant: "ghost" })}
            >
              <Github className="size-4" />
            </a>
          </div>
          <div>
            <ThemeToggle />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
