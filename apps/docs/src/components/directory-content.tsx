import type { transformedEntries } from "~/collections"
import { getBreadcrumbItems, getSections } from "~/collections"
import { SiteBreadcrumb } from "~/components/breadcrumb"
import { cn } from "~/lib/utils"
import SectionGrid from "./section-grid"
import Siblings from "./siblings"
import { MobileTableOfContents } from "./table-of-contents"

export async function DirectoryContent({
  transformedEntry,
}: {
  transformedEntry: Awaited<ReturnType<typeof transformedEntries>>[number]
}) {
  const [breadcrumbItems, sections] = await Promise.all([
    getBreadcrumbItems(transformedEntry.segments),
    getSections(transformedEntry.entry),
  ])

  return (
    <>
      <div className="container py-6">
        <MobileTableOfContents toc={[]} />

        <div className={cn("mt-12 gap-8 xl:mt-0 xl:grid")}>
          <div className="mx-auto w-full 2xl:w-6xl">
            <SiteBreadcrumb items={breadcrumbItems} />

            <article>
              <div
                className={cn(
                  // default prose
                  "prose dark:prose-invert",
                  // remove backtick from inline code block
                  "prose-code:before:hidden prose-code:after:hidden",
                  // use full width
                  "w-full max-w-full",
                )}
              >
                <h1
                  className="no-prose mb-2 scroll-m-20 text-4xl font-light tracking-tight lg:text-5xl"
                  data-pagefind-meta="title"
                >
                  {transformedEntry.title}
                </h1>
              </div>

              <SectionGrid sections={sections} />
            </article>

            <Siblings transformedEntry={transformedEntry} />
          </div>
        </div>
      </div>
    </>
  )
}
