"use client"

import type { z } from "zod"
import { useEffect, useState } from "react"
import { CheckIcon, ChevronRightIcon, ChevronsUpDown, SquareChartGanttIcon } from "lucide-react"

import type { headingSchema } from "~/validations"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { cn } from "~/lib/utils"
import { Button } from "./ui/button"
import { useSidebar } from "./ui/sidebar"

interface TocProps {
  toc: z.infer<typeof headingSchema>
}

export function TableOfContents({ toc }: TocProps) {
  const itemIds = toc.map((item) => item.id)
  const activeHeading = useActiveItem(itemIds)

  if (toc.length === 0) {
    return null
  }

  const filteredToc = toc.filter((item) => item.level > 1 && item.level < 4)

  return (
    <div className="space-y-4">
      <p className="font-bold">On This Page</p>
      <ul>
        {filteredToc.map((item, index) => {
          return (
            <li key={index} className={cn("mt-0 pt-2 first:pt-0")}>
              <a
                href={`#${item.id}`}
                className={cn(
                  item.level == 2 ? "pl-0" : "",
                  item.level == 3 ? "pl-4" : "",
                  "inline-block text-sm no-underline transition-colors hover:text-foreground",
                  item.id === `${activeHeading}` ? "text-orange-primary" : "text-muted-foreground",
                )}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function MobileTableOfContents({ toc }: TocProps) {
  const { toggleSidebar } = useSidebar()

  const itemIds = toc.map((item) => item.id)
  const activeHeading = useActiveItem(itemIds)

  const filteredToc = toc.filter((item) => item.level > 1 && item.level <= 4)

  return (
    <div
      className={cn(
        "fixed top-16 left-0 z-20 h-[calc(theme(height.12)+1px)] w-full border-b bg-background px-2 py-2.5 lg:left-[20rem] lg:w-[calc(theme(width.full)-20rem)]",
        {
          "lg:hidden": filteredToc.length === 0,
          "xl:hidden": filteredToc.length > 0,
        },
      )}
    >
      <div className="flex">
        <Button size={"sm"} className="mr-2 flex lg:hidden" onClick={toggleSidebar}>
          <ChevronRightIcon className="size-4" />
          Menu
        </Button>
        {filteredToc.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="w-full rounded-md ring-ring hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:outline-hidden data-[state=open]:bg-accent">
              <div className="flex items-center gap-1.5 overflow-hidden px-2 py-1.5 text-left text-sm transition-all">
                <SquareChartGanttIcon className="ml-auto h-4 w-4 text-muted-foreground/50" />
                <div className="line-clamp-1 flex-1 pr-2 font-medium">
                  {filteredToc.find((item) => item.id === activeHeading)?.text ??
                    "Table of contents"}
                </div>
                <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground/50" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="max-w-auto w-full min-w-full"
              align="start"
              side="bottom"
              sideOffset={4}
              style={{ width: "var(--radix-dropdown-menu-trigger-width)" }}
            >
              <DropdownMenuLabel>Table of contents</DropdownMenuLabel>
              {filteredToc.map((tocItem, index) => (
                <DropdownMenuItem
                  key={index}
                  className="items-start justify-between gap-2 px-1.5"
                  asChild
                >
                  <a
                    href={`#${tocItem.id}`}
                    className={cn(
                      "cursor-pointer",
                      tocItem.level == 2 ? "pl-2" : "",
                      tocItem.level == 3 ? "pl-4" : "",
                      tocItem.level == 4 ? "pl-6" : "",
                    )}
                  >
                    {tocItem.text}
                    <span className="relative top-0.5 flex items-center justify-center">
                      <CheckIcon
                        className={cn(
                          "mr-2 h-4 w-4",
                          tocItem.id === `${activeHeading}` ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </span>
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  )
}

function useActiveItem(itemIds: string[]) {
  const [activeId, setActiveId] = useState<string>("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: `0% 0% -80% 0%` },
    )

    itemIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      itemIds.forEach((id) => {
        const element = document.getElementById(id)
        if (element) {
          observer.unobserve(element)
        }
      })
    }
  }, [itemIds])

  return activeId
}
