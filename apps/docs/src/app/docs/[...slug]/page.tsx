import type { Metadata } from "next"
import { Space_Grotesk } from "next/font/google"
import { notFound } from "next/navigation"
import { isDirectory, isFile, MDX } from "renoun"

import {
  getFileContent,
  getDocumentationEntryBySlug,
  getMetadata,
  getSections,
  getTitle,
  staticRoutes,
  getBreadcrumbItems,
  getEntryFrontmatter,
} from "@/collection-helpers"
import type { EntryType } from "@/collection-helpers"
import { DocsPageActions } from "@/components/docs-page-actions"
import { ApiReference } from "@/components/mdx/api-reference"
import SectionGrid from "@/components/section-grid"
import Siblings from "@/components/siblings"
import { cn } from "@/lib/utils"
import { toRawHref } from "@/shared/doc-paths"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })
const SITE_URL = "https://vorsteh-queue.dev"

function toJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll("</", "<\\/")
}

export async function generateStaticParams() {
  const routes = await staticRoutes()
  return routes.map((slug) => ({ slug }))
}
export async function generateMetadata(
  params: PageProps<"/docs/[...slug]">
): Promise<Metadata> {
  const { slug } = await params.params
  const [collection] = slug

  let entry: EntryType | null = null

  try {
    entry = await getDocumentationEntryBySlug(slug)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch {
    entry = null
  }
  const breadcrumbItems = await getBreadcrumbItems(slug)
  const metadata = entry ? await getEntryFrontmatter(entry) : null

  const titles = breadcrumbItems.map((ele) => ele.title)

  const alternateTypes: NonNullable<Metadata["alternates"]>["types"] = {
    "application/x-ndjson": "/docs.snapshot.jsonl",
  }

  if (collection) {
    alternateTypes["application/x-ndjson+collection"] =
      `/docs.snapshot/${collection}.jsonl`
  }

  return {
    alternates: {
      types: alternateTypes,
    },
    description: metadata?.description ?? "",
    title: `${titles.join(" - ")}`,
  }
}
export default async function DocsPage({
  params,
}: PageProps<"/docs/[...slug]">) {
  const { slug } = await params
  const normalizedSlug = slug.filter((segment) => segment !== "index")
  const docsPath =
    normalizedSlug.length > 0 ? `/docs/${normalizedSlug.join("/")}` : "/docs"
  const pageUrl = `${SITE_URL}${docsPath}`

  let entry: EntryType | null = null
  try {
    entry = await getDocumentationEntryBySlug(slug)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch {
    notFound()
  }

  const sections = await getSections(entry)
  // oxlint-disable-next-line react-doctor/server-sequential-independent-await -- acceptable for readability
  const breadcrumbItems = await getBreadcrumbItems(slug)
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        item: `${SITE_URL}/docs`,
        name: "Docs",
        position: 1,
      },
      ...breadcrumbItems.map((item, index) => ({
        "@type": "ListItem",
        item: `${SITE_URL}/docs/${item.path.join("/")}`,
        name: item.title,
        position: index + 2,
      })),
    ],
  }

  if (!isFile(entry) && isDirectory(entry)) {
    const pageJsonLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      inLanguage: "en",
      isPartOf: {
        "@id": SITE_URL,
      },
      name: getTitle(entry),
      url: pageUrl,
    }

    return (
      <div>
        {/* oxlint-disable react/no-danger -- rendered HTML content from trusted source */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(pageJsonLd) }}
        />
        {/* oxlint-enable react/no-danger */}
        <MDX
          components={{
            // oxlint-disable-next-line react/no-unstable-nested-components
            h1: (props) => (
              // oxlint-disable-next-line jsx-a11y/heading-has-content
              <h1
                {...props}
                className="no-prose mt-20 mb-2 scroll-m-20 text-3xl font-light tracking-tight sm:text-4xl md:mt-0 md:text-5xl"
              />
            ),
          }}
        >
          {`# ${getTitle(entry)}`}
        </MDX>

        <MDX
          components={{
            // oxlint-disable-next-line react/no-unstable-nested-components
            code: (props) => <code>{props.children ?? ""}</code>,
            // oxlint-disable-next-line react/no-unstable-nested-components
            p: (props) => (
              <p
                {...props}
                className="prose text-muted-foreground mb-8 text-lg font-medium text-pretty sm:text-xl/8"
              />
            ),
          }}
        >
          {"&nbsp;"}
        </MDX>

        <article>
          <div
            className={cn(
              // default prose
              "prose dark:prose-invert",
              // remove backtick from inline code block
              "prose-code:before:hidden prose-code:after:hidden",
              // use full width
              "w-full max-w-none",
              "grow",

              // headings
              "prose-headings:scroll-mt-28",
              "prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2 prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight",
              "prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-xl prose-h3:font-semibold prose-h3:tracking-tight",
              "prose-h4:mt-6 prose-h4:mb-3 prose-h4:text-lg prose-h4:font-semibold prose-h4:tracking-tight",
              "prose-h5:mt-6 prose-h5:mb-3 prose-h5:text-base prose-h5:font-semibold",
              "prose-h6:mt-6 prose-h6:mb-3 prose-h6:text-sm prose-h6:font-semibold",

              // tables
              "prose-th:pb-0",
              "prose-table:my-0",

              // paragraphs
              "prose-p:leading-7 not-first:prose-p:mt-6",

              // blockquotes
              "prose-blockquote:mt-6 prose-blockquote:border-l-2 prose-blockquote:pl-6 prose-blockquote:italic",

              // lists
              "prose-ul:ml-6 prose-ul:list-disc [&>li]:prose-ul:mt-2 [&>ul]:prose-ul:my-2 [&>ul]:prose-ul:ml-0"
            )}
          >
            <SectionGrid sections={sections} />
          </div>
        </article>
        <Siblings entry={entry} />
      </div>
    )
  }

  const contentFile = await getFileContent(entry)

  if (!contentFile) {
    notFound()
  }

  const [Content, frontmatter, rawContent, sourceUrl] = await Promise.all([
    contentFile.getContent().catch(() => null),
    getMetadata(contentFile),
    contentFile.getText(),
    entry.getSourceUrl(),
  ])

  // Collect apiReference entries from frontmatter for rendering below content
  const apiReferenceEntries =
    frontmatter?.apiReference && Array.isArray(frontmatter.apiReference)
      ? (frontmatter.apiReference as { name: string; file: string }[])
      : []

  const rawHref = toRawHref(slug)
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    description: frontmatter?.description,
    headline: getTitle(entry, frontmatter, true),
    inLanguage: "en",
    isPartOf: {
      "@id": SITE_URL,
    },
    mainEntityOfPage: pageUrl,
    url: pageUrl,
  }

  return (
    <div>
      {/* oxlint-disable react/no-danger -- rendered HTML content from trusted source */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(articleJsonLd) }}
      />
      {/* oxlint-enable react/no-danger */}
      <h1
        className="no-prose mt-20 mb-2 scroll-m-20 text-3xl font-light tracking-tight sm:text-4xl md:mt-0 md:text-5xl"
        style={{ fontFamily: spaceGrotesk.style.fontFamily }}
      >
        {getTitle(entry, frontmatter, true)}
      </h1>

      <MDX
        components={{
          // oxlint-disable-next-line react/no-unstable-nested-components
          code: (props) => <code>{props.children ?? ""}</code>,
          // oxlint-disable-next-line react/no-unstable-nested-components
          p: (props) => (
            <p
              {...props}
              className="prose text-muted-foreground sm:text/8 mb-8 text-lg font-medium text-pretty"
            />
          ),
        }}
      >
        {frontmatter?.description ?? "&nbsp;"}
      </MDX>

      <DocsPageActions
        rawContent={rawContent}
        rawHref={rawHref}
        sourceHref={sourceUrl}
      />

      <article>
        <div
          className={cn(
            // default prose
            "prose dark:prose-invert",
            // remove backtick from inline code block
            "prose-code:before:hidden prose-code:after:hidden",
            // use full width
            "w-full max-w-none",
            "grow",

            // headings
            "prose-headings:scroll-mt-28",
            "prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:pb-2 prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight",
            "prose-h3:mt-8 prose-h3:mb-4 prose-h3:text-xl prose-h3:font-semibold prose-h3:tracking-tight",
            "prose-h4:mt-6 prose-h4:mb-3 prose-h4:text-lg prose-h4:font-semibold prose-h4:tracking-tight",
            "prose-h5:mt-6 prose-h5:mb-3 prose-h5:text-base prose-h5:font-semibold",
            "prose-h6:mt-6 prose-h6:mb-3 prose-h6:text-sm prose-h6:font-semibold",

            // tables
            "prose-th:pb-0",
            "prose-table:my-0",

            // paragraphs
            "prose-p:leading-7 not-first:prose-p:mt-6",

            // blockquotes
            "prose-blockquote:mt-6 prose-blockquote:border-l-2 prose-blockquote:pl-6 prose-blockquote:italic",

            // lists
            "prose-ul:ml-6 prose-ul:list-disc [&>li]:prose-ul:mt-2 [&>ul]:prose-ul:my-2 [&>ul]:prose-ul:ml-0"
          )}
        >
          {Content ? <Content /> : <div>No content</div>}

          {apiReferenceEntries.length > 0 && (
            <div className="mt-12">
              {apiReferenceEntries.map((ref) => (
                <ApiReference key={ref.file} file={ref.file} />
              ))}
            </div>
          )}

          <SectionGrid sections={sections} />
        </div>
      </article>
      <Siblings entry={entry} />
    </div>
  )
}
