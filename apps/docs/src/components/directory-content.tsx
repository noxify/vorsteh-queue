import type { EntryType } from "~/collections"
import { getBreadcrumbItems, getSections } from "~/collections"
import { SiteBreadcrumb } from "~/components/breadcrumb"
import SectionGrid from "~/components/section-grid"
import Siblings from "~/components/siblings"
import { cn } from "~/lib/utils"

export async function DirectoryContent({ source }: { source: EntryType }) {
  const [breadcrumbItems, sections] = await Promise.all([
    getBreadcrumbItems(source.getPathnameSegments()),
    getSections(source),
  ])

  return (
    <>
      <div className="container py-6">
        <div className={cn("gap-8 xl:grid")}>
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
                  {source.getTitle()}
                </h1>
              </div>

              <SectionGrid sections={sections} />
            </article>

            <Siblings source={source} />
          </div>
        </div>
      </div>
    </>
  )
}
