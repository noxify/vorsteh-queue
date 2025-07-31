"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import type { TreeItem } from "~/lib/navigation"
import { Button } from "~/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible"
import { useSidebar } from "~/components/ui/sidebar"
import { useIsMobile } from "~/hooks/use-mobile"
import { current } from "~/lib/helpers"
import { cn } from "~/lib/utils"

export function DocsSidebar({
  className,
  items,
  highlightActive = true,
}: {
  items: TreeItem[]
  highlightActive?: boolean
} & React.ComponentProps<"ul">) {
  const pathname = usePathname()
  const { toggleSidebar } = useSidebar()

  const isMobile = useIsMobile()

  if (items.length === 0) return <></>
  return (
    <ul className={cn("grid gap-y-1", className)}>
      {items.map((item) =>
        (item.children ?? []).length > 0 ? (
          <CollapsibleItem pathname={pathname} item={item} key={item.path} />
        ) : (
          <li key={item.path}>
            <div className="relative flex items-center">
              <Link
                prefetch={true}
                onClick={isMobile ? () => toggleSidebar() : undefined}
                href={item.path}
                className={cn(
                  "flex h-8 min-w-8 flex-1 items-center p-1.5 text-sm text-muted-foreground ring-ring outline-hidden transition-all hover:text-accent-foreground focus-visible:ring-2",
                  highlightActive && current({ pathname, item })
                    ? "text-orange-primary"
                    : "hover:text-orange-primary",
                )}
              >
                <div className="line-clamp-1 pr-6">{item.title}</div>
              </Link>
            </div>
          </li>
        ),
      )}
    </ul>
  )
}

function CollapsibleItem({ pathname, item }: { pathname: string; item: TreeItem }) {
  const isMobile = useIsMobile()
  const isCurrent = current({ pathname, item })
  const [open, setOpen] = useState(isCurrent)
  const { toggleSidebar } = useSidebar()

  useEffect(() => {
    setOpen(isCurrent)
  }, [isCurrent])

  return (
    <Collapsible key={item.path} asChild open={open} onOpenChange={setOpen}>
      <li className="relative">
        <div className="relative mb-0.5 flex items-center">
          <Link
            prefetch={true}
            href={item.path}
            onClick={isMobile ? () => toggleSidebar() : undefined}
            className={cn(
              "flex h-8 min-w-8 flex-1 items-center gap-2 p-1.5 text-sm text-muted-foreground ring-ring outline-hidden transition-all hover:text-accent-foreground focus-visible:ring-2",
              current({ pathname, item })
                ? "font-bold text-orange-primary hover:text-black dark:hover:text-white"
                : "font-bold hover:text-orange-primary",
            )}
          >
            {current({ pathname, item }) && item.depth > 1 && (
              <div
                aria-hidden="true"
                className="absolute top-0 bottom-0 -left-[9px] z-50 w-[1px] bg-indigo-400"
              ></div>
            )}
            <div className="line-clamp-1 pr-6">{item.title}</div>
          </Link>

          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="absolute right-1 h-6 w-6 rounded-md p-0 ring-ring transition-all focus-visible:ring-2 data-[state=open]:rotate-90"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="sr-only">Toggle</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="py-0.5 pl-2">
          <ul className="grid gap-y-1 border-l border-muted-foreground/15 pl-2">
            {item.children?.map((subItem) => {
              if ((subItem.children ?? []).length > 0) {
                return (
                  <li key={subItem.path}>
                    <DocsSidebar items={[subItem]} />
                  </li>
                )
              }

              return (
                <li key={subItem.path} className="relative">
                  <Link
                    prefetch={true}
                    href={subItem.path}
                    onClick={isMobile ? () => toggleSidebar() : undefined}
                    className={cn(
                      "flex h-8 min-w-8 flex-1 items-center gap-2 p-1.5 text-sm text-muted-foreground ring-ring outline-hidden transition-all hover:text-muted-foreground focus-visible:ring-2",
                      current({ pathname, item: subItem })
                        ? "font-bold text-orange-primary hover:text-black dark:hover:text-white"
                        : "hover:text-orange-primary",
                    )}
                  >
                    {current({ pathname, item: subItem }) && (
                      <div
                        aria-hidden="true"
                        className="absolute top-0 bottom-0 -left-[9px] z-50 w-[1px] bg-orange-primary"
                      ></div>
                    )}
                    <div className="line-clamp-1">{subItem.title}</div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </li>
    </Collapsible>
  )
}
