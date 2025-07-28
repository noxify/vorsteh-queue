import { Fragment } from "react"
import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { removeFromArray } from "~/lib/utils"

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
    return input.map((item) => ({
      type: "element",
      title: item.title,
      path: ["docs", ...removeFromArray(item.path, ["docs"])],
    }))
  }

  const groupItems = input.slice(1, -2)
  const restItems = input
    .slice(input.length - 2)
    .map((item) => ({ type: "element", ...item })) as ElementItem[]
  return [
    { type: "element", ...input[0] } as ElementItem,
    { type: "group", items: groupItems.reverse() } as GroupItem,
    ...restItems,
  ]
}

export function SiteBreadcrumb({ items }: { items: { title: string; path: string[] }[] }) {
  const breadcrumbItems = groupBreadcrumb(items)
  const searchBreadcrumb = breadcrumbItems
    .slice(1)
    .map((item) => {
      if (item.type === "group") {
        return item.items.map((ele) => ele.title)
      }

      return item.title
    })
    .flat()
    .join(" / ")

  return (
    <Breadcrumb
      className="mb-4 w-full"
      data-pagefind-ignore
      data-pagefind-meta={`breadcrumb:${searchBreadcrumb}`}
    >
      <BreadcrumbList>
        {breadcrumbItems.map((item, idx) => {
          return (
            <Fragment key={idx}>
              {idx > 0 && <BreadcrumbSeparator />}
              {item.type == "element" && (
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/${item.path.join("/")}`} prefetch={true}>
                      {item.title}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              )}
              {item.type == "group" && (
                <BreadcrumbItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center gap-1">
                      <BreadcrumbEllipsis className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {item.items.map((subItem, idy) => (
                        <DropdownMenuItem key={idy} asChild className="cursor-pointer">
                          <Link href={`/${subItem.path.join("/")}`} prefetch={true}>
                            {subItem.title}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </BreadcrumbItem>
              )}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
