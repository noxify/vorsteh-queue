import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import type { getTransformedEntry } from "~/collections"
import { getSiblings } from "~/collections"

export default async function Siblings({
  transformedEntry,
}: {
  transformedEntry: Awaited<ReturnType<typeof getTransformedEntry>>
}) {
  const [previousPage, nextPage] = await getSiblings(transformedEntry)

  if (!previousPage && !nextPage) {
    return <></>
  }

  return (
    <nav
      className="mt-6 flex items-center justify-between border-t border-cream-200 pt-6 dark:border-dark-100"
      data-pagefind-ignore
    >
      <div className="flex w-0 flex-1">
        {previousPage && (
          <>
            <Link
              prefetch={true}
              href={previousPage.raw_pathname}
              className="text-gray-700"
              title={`Go to previous page: ${previousPage.title}`}
            >
              <div className="group flex shrink-0 items-center gap-x-4">
                <ChevronLeftIcon className="h-5 w-5 flex-none text-gray-500 transition-colors duration-200 group-hover:text-orange-primary dark:text-white dark:group-hover:text-orange-primary" />
                <div className="flex flex-col items-start">
                  <p className="text-xs leading-5 text-orange-primary">Previous page</p>
                  <p className="text-sm leading-5 text-gray-600 transition-colors duration-200 group-hover:text-orange-primary dark:text-white dark:group-hover:text-orange-primary">
                    {previousPage.title}
                  </p>
                </div>
              </div>
            </Link>
          </>
        )}
      </div>

      <div className="-mt-px flex w-0 flex-1 justify-end">
        {nextPage && (
          <>
            <Link
              prefetch={true}
              href={nextPage.raw_pathname}
              className="text-gray-700"
              title={`Go to next page: ${nextPage.title}`}
            >
              <div className="group flex shrink-0 items-center gap-x-4">
                <div className="flex flex-col items-end">
                  <p className="text-xs leading-5 text-orange-primary">Next page</p>
                  <p className="text-sm leading-5 text-gray-600 transition-colors duration-200 group-hover:text-orange-primary dark:text-white dark:group-hover:text-orange-primary">
                    {nextPage.title}
                  </p>
                </div>
                <ChevronRightIcon className="h-5 w-5 flex-none text-gray-500 transition-colors duration-200 group-hover:text-orange-primary dark:text-white dark:group-hover:text-orange-primary" />
              </div>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
