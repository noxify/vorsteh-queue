import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { isFile } from "renoun/file-system"

import type { EntryType } from "@/collection-helpers"
import { getCollectionLinearNavigation } from "@/lib/navigation"

function toDocsUrl(entry: EntryType) {
  const normalizedEntry =
    isFile(entry) && (entry.baseName === "index" || entry.baseName === "readme")
      ? entry.getParent()
      : entry

  const segments = normalizedEntry.getPathnameSegments({
    includeBasePathname: true,
  })

  return `/${["docs", ...segments].join("/")}`
}

export default async function Siblings({ entry }: { entry: EntryType }) {
  const [collection] = entry.getPathnameSegments({ includeBasePathname: true })

  if (!collection) {
    return null
  }

  const orderedItems = await getCollectionLinearNavigation(collection)
  const currentUrl = toDocsUrl(entry)
  const currentIndex = orderedItems.findIndex((item) => item.url === currentUrl)

  if (currentIndex === -1) {
    return null
  }

  const previousItem =
    currentIndex > 0 ? orderedItems[currentIndex - 1] : undefined
  const nextItem =
    currentIndex < orderedItems.length - 1
      ? orderedItems[currentIndex + 1]
      : undefined

  if (!previousItem && !nextItem) {
    return null
  }

  return (
    <nav className="mt-6 flex items-center justify-between border-t pt-6">
      <div className="flex w-0 flex-1">
        {previousItem && (
          <Link
            prefetch={false}
            href={previousItem.url}
            className="text-gray-700"
            title={`Go to previous page: ${previousItem.title}`}
          >
            <div className="group flex shrink-0 items-center gap-x-4">
              <ChevronLeftIcon className="h-5 w-5 flex-none text-gray-500 transition-colors duration-200 group-hover:text-indigo-400 dark:text-gray-400 dark:group-hover:text-white" />
              <div className="flex flex-col items-start">
                <p className="text-xs leading-5 text-gray-500">Previous page</p>
                <p className="text-sm leading-5 font-medium text-gray-500 transition-colors duration-200 group-hover:text-indigo-400 dark:text-gray-400 dark:group-hover:text-white">
                  {previousItem.title}
                </p>
              </div>
            </div>
          </Link>
        )}
      </div>

      <div className="-mt-px flex w-0 flex-1 justify-end">
        {nextItem && (
          <Link
            prefetch={false}
            href={nextItem.url}
            className="text-gray-700"
            title={`Go to next page: ${nextItem.title}`}
          >
            <div className="group flex shrink-0 items-center gap-x-4">
              <div className="flex flex-col items-end">
                <p className="text-xs leading-5 text-gray-500">Next page</p>
                <p className="group-hover:text-foreground text-sm leading-5 text-gray-500 transition-colors duration-200 dark:text-gray-400 dark:group-hover:text-white">
                  {nextItem.title}
                </p>
              </div>
              <ChevronRightIcon className="group-hover:text-foreground h-5 w-5 flex-none text-gray-500 transition-colors duration-200 dark:text-gray-400 dark:group-hover:text-white" />
            </div>
          </Link>
        )}
      </div>
    </nav>
  )
}
