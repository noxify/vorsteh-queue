import Link from "next/link"
import { Fragment } from "react"

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Item {
  title: string
  path: string[]
}

type ElementItem = { type: "element" } & Item

interface GroupItem {
  type: "group"
  items: Item[]
}

function groupBreadcrumb(input: Item[]): (ElementItem | GroupItem)[] {
  if (input.length <= 3) {
    return input.map((item) => ({ type: "element" as const, ...item }))
  }

  const [firstItem, ...remainingItems] = input
  if (!firstItem) {
    return []
  }

  const groupItems = remainingItems.slice(0, -2)
  const restItems = remainingItems
    .slice(-2)
    .map((item) => ({ type: "element" as const, ...item }))

  return [
    { type: "element" as const, ...firstItem },
    { type: "group", items: groupItems.toReversed() },
    ...restItems,
  ]
}

export function SiteBreadcrumb({
  items,
}: {
  items: { title: string; path: string[] }[]
}) {
  const breadcrumbItems = groupBreadcrumb(items)

  return (
    <Breadcrumb className="mb-4 hidden w-full md:block">
      <BreadcrumbList>
        {breadcrumbItems.map((item, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <BreadcrumbSeparator />}
            {item.type === "element" && (
              <BreadcrumbItem>
                <BreadcrumbLink
                  render={
                    <Link
                      href={`/docs/${item.path.join("/")}`}
                      prefetch={false}
                    >
                      {item.title}
                    </Link>
                  }
                ></BreadcrumbLink>
              </BreadcrumbItem>
            )}
            {item.type === "group" && (
              <BreadcrumbItem>
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-1">
                    <BreadcrumbEllipsis className="h-4 w-4" />
                    <span className="sr-only">Toggle menu</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {item.items.map((subItem, idy) => (
                      <DropdownMenuItem
                        key={idy}
                        render={
                          <Link
                            href={`/docs/${subItem.path.join("/")}`}
                            prefetch={false}
                          >
                            {subItem.title}
                          </Link>
                        }
                        className="cursor-pointer"
                      ></DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
