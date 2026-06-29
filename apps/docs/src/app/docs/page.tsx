// oxlint-disable react/no-unstable-nested-components
import {
  ArrowRightIcon,
  BotIcon,
  FileTextIcon,
  SparklesIcon,
} from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"
import { MDX } from "renoun"

import { rootCollections } from "@/collection-helpers"
import { PageContainer } from "@/components/page-container"
import SectionGrid from "@/components/section-grid"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { DEFAULT_DOCS_PATH } from "@/lib/docs-default"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

interface QuickLink {
  title: string
  description: string
  href?: string
  icon: typeof FileTextIcon
}

const QUICK_LINKS: readonly QuickLink[] = [
  {
    title: "llms.txt",
    description:
      "Compact machine-readable index with key entry points and links to core documentation sections.",
    href: "/llms.txt",
    icon: FileTextIcon,
  },
  {
    title: "llms-full.txt",
    description:
      "Full machine-readable export covering all docs pages and richer context for deeper AI ingestion workflows.",
    href: "/llms-full.txt",
    icon: BotIcon,
  },
  {
    title: "View as Markdown",
    description:
      "Open any docs page and use the `View as Markdown` action to access the source markdown directly.",
    icon: SparklesIcon,
  },
] as const

export default async function DocsIndexPage() {
  const collections = await rootCollections()

  return (
    <div className="relative min-h-svh">
      <SiteHeader />

      <main>
        <PageContainer className="px-4 py-10 sm:px-6 lg:px-8">
          <section className="mb-10">
            <h1
              className="text-foreground mb-3 text-4xl font-semibold tracking-tight sm:text-5xl"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              LakeQL Docs Overview
            </h1>
            <p className="text-muted-foreground max-w-3xl text-lg text-pretty">
              Start with a collection below, or jump into machine-readable docs
              links for AI tooling and automation workflows.
            </p>

            <div className="mt-6">
              <Link
                href={DEFAULT_DOCS_PATH}
                prefetch={false}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Open Getting Started
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section className="mb-12">
            <h2
              className="mb-4 text-2xl font-semibold tracking-tight"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              Collections
            </h2>
            <SectionGrid
              className="mt-0 xl:grid-cols-3 2xl:grid-cols-3"
              items={collections.map((collection) => ({
                description:
                  collection.description ?? "Explore this docs collection.",
                path: collection.entrypoint,
                title: collection.title,
              }))}
            />
          </section>

          <section>
            <h2
              className="mb-4 text-2xl font-semibold tracking-tight"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              LLM and Raw Links
            </h2>
            <div className="grid auto-rows-fr gap-4 md:grid-cols-3">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon
                const cardClasses =
                  "group hover:border-brand/40 bg-card rounded-xl border border-black/10 p-4 transition-colors dark:border-white/10"

                const content = (
                  <>
                    <div className="mb-3 inline-flex rounded-md border border-black/10 p-2 dark:border-white/10">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-foreground mb-1 font-semibold">
                      {link.title}
                    </h3>
                    <div className="text-muted-foreground text-sm">
                      <MDX
                        components={{
                          code: (props) => (
                            <code
                              className="bg-muted text-foreground rounded px-1 py-0.5 text-[0.85em]"
                              {...props}
                            />
                          ),
                          p: (props) => <p className="m-0" {...props} />,
                        }}
                      >
                        {link.description}
                      </MDX>
                    </div>
                  </>
                )

                if (link.href) {
                  return (
                    <Link
                      key={link.title}
                      href={link.href}
                      prefetch={false}
                      className={cardClasses}
                    >
                      {content}
                    </Link>
                  )
                }

                return (
                  <div
                    key={link.title}
                    className={cardClasses}
                    aria-label={`${link.title} information`}
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          </section>
        </PageContainer>
      </main>

      <SiteFooter />
    </div>
  )
}
