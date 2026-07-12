"use client"

import { ChevronRight, ExternalLinkIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { current } from "@/lib/helpers"
import { getNavIconComponent } from "@/lib/nav-icons"
import type { NavBadge, TreeItem } from "@/lib/navigation"
import { cn } from "@/lib/utils"

import { RenderIcon } from "./render-icon"
import {
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarSeparator,
} from "./ui/sidebar"

const badgeVariants: Record<Exclude<NavBadge, "pulse">, string> = {
  beta: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  deprecated: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  experimental:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  new: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  updated:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
}

function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn("pointer-events-none absolute flex size-2", className)}>
      <span className="bg-brand-600 relative inline-flex size-2 rounded-full" />
    </span>
  )
}

export function SidebarItem({
  item,
  isSubItem = false,
}: {
  item: TreeItem
  isSubItem?: boolean
}) {
  const pathname = usePathname()
  const isActive = current({ item, pathname })
  const icon = getNavIconComponent(item.navIcon)

  if (!item.children || item.children.length === 0) {
    const buttonClass = cn(
      "bg-transparent text-sidebar-foreground/60 hover:bg-transparent! active:bg-transparent! data-active:bg-transparent! data-active:hover:bg-transparent! hover:text-foreground data-active:hover:text-foreground!",
      {
        "text-brand-600! hover:text-foreground dark:text-brand-400!": isActive,
      }
    )
    return (
      <>
        {item.separator && <SidebarSeparator className="my-2" />}
        <SidebarMenuItem>
          <div
            aria-hidden="true"
            className={cn(
              "bg-brand-500 dark:bg-brand-400 absolute top-0 bottom-0 -left-2.5 z-10 w-0.5",
              isSubItem && isActive ? "block" : "hidden"
            )}
          />
          {item.external ? (
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={item.url}
              className={cn(
                "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-open:hover:bg-sidebar-accent data-open:hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate",
                buttonClass
              )}
              data-active={isActive ? "true" : undefined}
            >
              <RenderIcon
                aria-hidden="true"
                icon={icon}
                className="size-3.5 shrink-0"
              />
              <span className="flex min-w-0 items-center truncate">
                {item.title}
                <ExternalLinkIcon className="ml-1.5 opacity-70" />
              </span>
            </a>
          ) : (
            <SidebarMenuButton
              isActive={isActive}
              variant="default"
              className={buttonClass}
              render={<Link href={item.url} prefetch={false} />}
            >
              <div className="line-clamp-1 flex w-full items-center gap-2">
                <RenderIcon
                  aria-hidden="true"
                  icon={icon}
                  className="size-3.5 shrink-0"
                />
                <span className="min-w-0 truncate">{item.title}</span>
              </div>
            </SidebarMenuButton>
          )}
          {item.navBadge === "pulse" ? (
            <PulseDot className="top-1/2 right-2 -translate-y-1/2" />
          ) : (item.navBadge ? (
            <SidebarMenuBadge className={badgeVariants[item.navBadge]}>
              {item.navBadge}
            </SidebarMenuBadge>
          ) : null)}
        </SidebarMenuItem>
      </>
    )
  }

  return (
    <>
      {item.separator && <SidebarSeparator className="my-2" />}
      <SidebarMenuItem>
        <Collapsible
          key={`${item.url}-${isActive}`}
          defaultOpen={isActive}
          className="group/collapsible"
        >
          <div className="group relative">
            <CollapsibleTrigger
              render={
                <SidebarMenuAction
                  showOnHover={false} // Always show the Chevron
                  className="peer z-10 cursor-pointer opacity-100 [&[data-panel-open]>svg]:rotate-90"
                  aria-label={`Toggle ${item.title}`}
                />
              }
            >
              <ChevronRight className="transition-transform" />
            </CollapsibleTrigger>

            <SidebarMenuButton
              variant="default"
              isActive={isActive}
              className="peer-hover:bg-transparent hover:bg-transparent data-[active=true]:bg-transparent"
              render={<Link prefetch={false} href={item.url} />}
            >
              <div className="flex min-w-0 items-center gap-2">
                <RenderIcon
                  aria-hidden="true"
                  icon={icon}
                  className="size-3.5 shrink-0"
                />
                <span
                  className={cn("truncate", {
                    "text-brand-600 hover:text-brand-600 group-hover/menu-button:text-brand-600 dark:text-brand-400 dark:hover:text-brand-400 dark:group-hover/menu-button:text-brand-400":
                      isActive,
                    "text-sidebar-foreground/60 hover:text-foreground group-hover/menu-button:text-foreground":
                      !isActive,
                  })}
                >
                  {item.title}
                </span>
              </div>
            </SidebarMenuButton>
            {item.navBadge === "pulse" ? (
              <PulseDot className="top-1/2 right-8 -translate-y-1/2" />
            ) : (item.navBadge ? (
              <SidebarMenuBadge
                className={cn(badgeVariants[item.navBadge], "right-7")}
              >
                {item.navBadge}
              </SidebarMenuBadge>
            ) : null)}
          </div>
          <CollapsibleContent>
            <SidebarMenuSub className="mr-0 ml-2 pr-0 pl-2">
              {item.children.map((subItem) => (
                <SidebarItem key={subItem.url} item={subItem} isSubItem />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    </>
  )
}
