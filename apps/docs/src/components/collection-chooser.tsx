import { ChevronsUpDownIcon } from "lucide-react"
import Link from "next/link"

import type { rootCollections } from "@/collection-helpers"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item"

export function CollectionChooser({
  currentCollection,
  collections,
}: {
  currentCollection:
    | Awaited<ReturnType<typeof rootCollections>>[number]
    | undefined
  collections: Awaited<ReturnType<typeof rootCollections>>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Item
          size="xs"
          variant="outline"
          className="bg-background hover:cursor-pointer"
        >
          <ItemContent className="gap-0">
            <ItemTitle>
              {currentCollection?.title ?? "Unknown collection"}
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <ChevronsUpDownIcon className="size-4" />
          </ItemActions>
        </Item>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80">
        {collections.map((item) => (
          <Link href={item.entrypoint} prefetch={false} key={item.group}>
            <DropdownMenuItem className="hover:cursor-pointer">
              <Item size="xs">
                <ItemContent className="gap-0">
                  <ItemTitle>{item.title}</ItemTitle>
                  <ItemDescription>{item.description}</ItemDescription>
                </ItemContent>
              </Item>
            </DropdownMenuItem>
          </Link>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
