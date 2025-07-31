import { notFound } from "next/navigation"
import { ExternalLinkIcon } from "lucide-react"
import { Markdown } from "renoun/components"

import type { transformedEntries } from "~/collections"
import { getBreadcrumbItems, getMetadata, getSections } from "~/collections"
import { SiteBreadcrumb } from "~/components/breadcrumb"
import SectionGrid from "~/components/section-grid"
import Siblings from "~/components/siblings"
import { MobileTableOfContents, TableOfContents } from "~/components/table-of-contents"
import { cn } from "~/lib/utils"

export async function FileContent({
  transformedEntry,
}: {
  transformedEntry: Awaited<ReturnType<typeof transformedEntries>>[number]
}) {
  if (!transformedEntry.file) return notFound()

  const [Content, frontmatter, headings, breadcrumbItems, sections] = await Promise.all([
    transformedEntry.file.getExportValue("default"),
    getMetadata(transformedEntry.file),
    transformedEntry.file.getExportValue("headings"),
    getBreadcrumbItems(transformedEntry.segments),
    getSections(transformedEntry.entry),
  ])

  const pagefindProps = !frontmatter?.ignoreSearch
    ? {
        "data-pagefind-body": "",
      }
    : {}

  return (
    <>
      <div className="container py-6">
        <MobileTableOfContents toc={headings.length > 0 && frontmatter?.toc ? headings : []} />

        <div
          className={cn("mt-12 gap-8 xl:mt-0 xl:grid", {
            "lg:mt-0": !frontmatter?.toc,
            "xl:grid-cols-[1fr_300px]": frontmatter?.toc,
            "xl:grid-cols-1": !frontmatter?.toc,
          })}
        >
          <div
            className={cn("mx-auto", {
              "w-full 2xl:w-6xl": !frontmatter?.toc,
              "w-full 2xl:w-4xl": frontmatter?.toc,
            })}
          >
            <SiteBreadcrumb items={breadcrumbItems} />

            <div {...pagefindProps}>
              <Markdown
                components={{
                  h1: (props) => (
                    <h1
                      {...props}
                      className="no-prose mb-2 scroll-m-20 text-3xl font-light tracking-tight sm:text-4xl md:text-5xl"
                      data-pagefind-meta="title"
                    />
                  ),
                }}
              >
                {`# ${frontmatter?.title ?? transformedEntry.title}`}
              </Markdown>

              <Markdown
                components={{
                  p: (props) => (
                    <p
                      {...props}
                      className="prose mb-8 text-lg font-medium text-pretty text-muted-foreground sm:text-xl/8"
                    />
                  ),
                  code: (props) => <code>{props.children ?? ""}</code>,
                }}
              >
                {frontmatter?.description ?? "&nbsp;"}
              </Markdown>

              <article>
                <div
                  className={cn(
                    // default prose
                    "prose dark:prose-invert",
                    // remove backtick from inline code block
                    //"prose-code:before:hidden prose-code:after:hidden",
                    // use full width
                    "max-w-auto w-full min-w-full",
                    "grow",

                    "prose-table:my-0",
                    "prose-th:pb-0",

                    "xl:prose-headings:scroll-mt-20",
                    "prose-headings:scroll-mt-28",

                    "prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2 prose-h2:text-3xl prose-h2:font-semibold prose-h2:tracking-tight",
                    "prose-h3:text-2xl prose-h3:font-semibold prose-h3:tracking-tight",
                    "prose-h4:text-xl prose-h4:font-semibold prose-h4:tracking-tight",

                    "prose-blockquote:mt-6 prose-blockquote:border-l-2 prose-blockquote:pl-6 prose-blockquote:italic",
                    "prose-p:leading-7 not-first:prose-p:mt-6",
                    "prose-a:text-orange-primary prose-a:hover:text-black prose-a:dark:hover:text-white",

                    "prose-ul:ml-2 prose-ul:list-disc [&>li]:prose-ul:mt-2 [&>ul]:prose-ul:my-2 [&>ul]:prose-ul:ml-0",
                  )}
                >
                  <Content />
                </div>

                <SectionGrid sections={sections} />
              </article>
            </div>
            <Siblings transformedEntry={transformedEntry} />
          </div>
          {frontmatter?.toc ? (
            <div className="hidden w-[19.5rem] xl:sticky xl:top-[6.55rem] xl:-mr-6 xl:block xl:h-[calc(100vh-6.55rem)] xl:flex-none xl:overflow-y-auto xl:pr-6 xl:pb-16">
              <TableOfContents toc={headings} />

              <div
                className={cn("my-6 grid gap-y-4", {
                  "border-t pt-6": headings.length > 0,
                })}
              >
                <div className="justify-center text-sm text-muted-foreground">
                  {/* eslint-disable-next-line no-restricted-properties */}
                  {process.env.NODE_ENV === "development" ? (
                    <a
                      href={transformedEntry.entry.getEditorUri()}
                      className="hover:text-orange-primary"
                    >
                      View source <ExternalLinkIcon className="inline h-4 w-4" />
                    </a>
                  ) : (
                    <a
                      href={transformedEntry.entry.getSourceUrl()}
                      target="_blank"
                      className="hover:text-orange-primary"
                    >
                      View source <ExternalLinkIcon className="inline h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
