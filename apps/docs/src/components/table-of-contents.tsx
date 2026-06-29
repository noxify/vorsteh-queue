// oxlint-disable react/no-unstable-nested-components
"use client"

import { CheckIcon, ChevronsUpDown, SquareChartGanttIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useReducer, useRef } from "react"
import type { TableOfContentsProps } from "renoun"

import { TableOfContents as RenounTableOfContents } from "@/components/toc"
import { cn } from "@/lib/utils"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { useSidebar } from "./ui/sidebar"

type DocsTableOfContentsProps = Omit<
  TableOfContentsProps,
  "children" | "components"
>

export function TableOfContents({ sections }: DocsTableOfContentsProps) {
  const { isMobile } = useSidebar()

  if (isMobile) {
    return null
  }

  return (
    <RenounTableOfContents
      sections={sections}
      components={{
        Item: (props) => (
          <li className="mb-1 text-sm leading-6 last:mb-0" {...props} />
        ),
        Link: (props) => (
          // oxlint-disable-next-line jsx-a11y/anchor-has-content
          <a
            {...props}
            className="text-foreground/80 hover:text-foreground aria-[current]:text-foreground aria-[current]:font-bold"
          />
        ),
        List: ({ depth, children }) => (
          <ol
            data-depth={depth}
            className={cn("mt-1", {
              "pl-0": depth === 0,
              "pl-4": depth >= 1,
            })}
          >
            {children}
          </ol>
        ),
        Root: (props) => (
          <nav
            className="pointer-events-auto sticky top-8 flex max-h-[calc(100vh-3.5rem-2rem)] shrink-0 flex-col gap-3 overflow-y-auto pr-6"
            {...props}
          />
        ),
        Title: (props) => (
          <h4 className="mt-0 mb-4 text-xs font-medium uppercase" {...props}>
            On this page
          </h4>
        ),
      }}
    />
  )
}

function collectAllSectionIds(
  sections: DocsTableOfContentsProps["sections"],
  ids: string[] = []
): string[] {
  for (const section of sections) {
    ids.push(section.id)
    if (section.children) {
      collectAllSectionIds(section.children, ids)
    }
  }
  return ids
}

export function MobileTableOfContents({ sections }: DocsTableOfContentsProps) {
  const allItemIds = collectAllSectionIds(sections)
  const activeHeading = useActiveItem(allItemIds)

  const { isMobile } = useSidebar()

  const activeSectionTitle = activeHeading
    ? findSectionTitle(sections, activeHeading)
    : undefined

  function renderSections(
    items: DocsTableOfContentsProps["sections"],
    depth = 0
  ): React.ReactNode {
    if (items.length === 0) {
      return null
    }

    return (
      <ol
        className={cn("grid gap-1", {
          "ml-2 border-l pl-2": depth >= 1,
          "px-1.5": depth === 0,
        })}
      >
        {items.map((section) => (
          <li key={section.id} className="list-none">
            <DropdownMenuItem className="p-0">
              <a
                href={`#${section.id}`}
                className={cn(
                  "focus:bg-accent focus:text-accent-foreground flex w-full items-start gap-2 rounded-sm px-1.5 py-1.5 outline-hidden",
                  section.id === activeHeading &&
                    "bg-accent text-accent-foreground"
                )}
              >
                <span className="min-w-0 flex-1">
                  {"jsx" in section && section.jsx !== undefined
                    ? section.jsx
                    : section.title}
                </span>
                <span className="relative top-0.5 flex items-center justify-center">
                  <CheckIcon
                    className={cn(
                      "h-4 w-4",
                      section.id === activeHeading ? "opacity-100" : "opacity-0"
                    )}
                  />
                </span>
              </a>
            </DropdownMenuItem>
            {section.children &&
              section.children.length > 0 &&
              renderSections(section.children, depth + 1)}
          </li>
        ))}
      </ol>
    )
  }

  return (
    <div
      className={cn(
        "bg-background sticky flex h-[calc(theme(height.12)+1px)] w-full items-center border-b px-2 transition-[top] duration-300 ease-in-out xl:hidden",
        {
          "top-0": !isMobile,
          "top-14": isMobile,
        }
      )}
    >
      <div className="flex w-full items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="ring-ring hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent w-full rounded-md focus-visible:ring-2 focus-visible:outline-hidden">
            <div className="flex items-center gap-1.5 overflow-hidden px-2 py-1.5 text-left text-sm transition-all">
              <SquareChartGanttIcon className="text-muted-foreground/50 h-4 w-4 shrink-0" />
              <div className="line-clamp-1 flex-1 pr-2 font-medium">
                {activeSectionTitle ?? "Table of contents"}
              </div>
              <ChevronsUpDown className="text-muted-foreground/50 h-4 w-4 shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="max-h-[calc(100vh-8rem)] w-full! overflow-y-auto"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <div className="text-muted-foreground px-1.5 py-1 text-xs font-medium">
              Table of contents
            </div>
            {renderSections(sections)}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function findSectionTitle(
  sections: DocsTableOfContentsProps["sections"],
  id: string
): ReactNode | undefined {
  for (const section of sections) {
    if (section.id === id) {
      return "jsx" in section && section.jsx !== undefined
        ? section.jsx
        : section.title
    }

    if (section.children) {
      const childTitle = findSectionTitle(section.children, id)
      if (childTitle) {
        return childTitle
      }
    }
  }

  return undefined
}

function useActiveItem(itemIds: string[], activationRatio = 0.2) {
  const [activeId, setActiveId] = useReducer(
    (_current: string | null, next: string | null) => next,
    null
  )
  const clickedIdRef = useRef<string | null>(null)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    const smoothScrollBehavior: ScrollBehavior = prefersReducedMotion
      ? "auto"
      : "smooth"

    const observer = new IntersectionObserver(
      (_entries) => {
        const vh = window.innerHeight || document.documentElement.clientHeight
        const clickedId = clickedIdRef.current

        // Keep a clicked TOC heading active while it is visible to avoid
        // flicker near the end of long pages where headings cannot reach the
        // activation line anymore.
        if (clickedId) {
          // oxlint-disable-next-line unicorn/prefer-query-selector
          const clickedElement = document.getElementById(clickedId)
          if (clickedElement) {
            const clickedRect = clickedElement.getBoundingClientRect()
            const isClickedVisible =
              clickedRect.top < vh && clickedRect.bottom > 0

            if (isClickedVisible) {
              setActiveId(clickedId)
              return
            }
          }

          clickedIdRef.current = null
        }

        const offsetTop = vh * activationRatio
        let bestIndex = -1
        let bestTop = -Infinity

        // Finde das oberste sichtbare Element
        for (let index = 0; index < itemIds.length; index += 1) {
          const id = itemIds[index]
          if (!id) {
            continue
          }
          // oxlint-disable-next-line unicorn/prefer-query-selector
          const element = document.getElementById(id)
          if (!element) {
            continue
          }

          const rect = element.getBoundingClientRect()
          if (rect.top <= offsetTop && rect.top > bestTop) {
            bestTop = rect.top
            bestIndex = index
          }
        }

        const bestElementId = bestIndex >= 0 ? itemIds[bestIndex] : undefined
        if (bestElementId) {
          setActiveId(bestElementId)
        } else if (window.scrollY < 50) {
          setActiveId(null)
        }
      },
      {
        rootMargin: `-${activationRatio * 100}% 0px 0px 0px`,
        threshold: [0, 1],
      }
    )

    for (const id of itemIds) {
      // oxlint-disable-next-line unicorn/prefer-query-selector
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    }

    // Click Handler für Links
    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) {
        return
      }

      const target = event.target.closest("a[href*='#']")
      if (!(target instanceof HTMLAnchorElement)) {
        return
      }

      const { href } = target
      if (!href.includes("#")) {
        return
      }

      const id = href.slice(href.indexOf("#") + 1)
      // oxlint-disable-next-line unicorn/prefer-query-selector
      const section = document.getElementById(id)
      if (!section) {
        return
      }

      event.preventDefault()

      // Scroll into view
      section.scrollIntoView({ behavior: smoothScrollBehavior, block: "start" })
      clickedIdRef.current = id
      setActiveId(id)

      // Update URL
      window.history.pushState(null, "", `#${id}`)
    }

    document.addEventListener("click", handleClick)

    return () => {
      observer.disconnect()
      document.removeEventListener("click", handleClick)
    }
  }, [itemIds, activationRatio])

  return activeId
}
