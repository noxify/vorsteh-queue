import type { ContentSection } from "renoun/file-system"
import { isFile } from "renoun/file-system"
import type z from "zod"

import {
  getFileContent,
  getDocumentationEntryBySlug,
  getApiReferenceExports,
  rootCollections,
  getBreadcrumbItems,
  getMetadata,
} from "@/collection-helpers"
import type { ApiReferenceResult } from "@/collection-helpers"
import { SiteBreadcrumb } from "@/components/breadcrumb"
import { CollectionChooser } from "@/components/collection-chooser"
import { DocsLeftRailBackground } from "@/components/docs-left-rail-background"
import { DocsSidebar } from "@/components/docs-sidebar"
import { MobileDocsHeader } from "@/components/mobile-docs-header"
import { SidebarToggle } from "@/components/sidebar-toggle"
import {
  MobileTableOfContents,
  TableOfContents,
} from "@/components/table-of-contents"
import { TableOfContentsScript } from "@/components/toc"
import { SidebarInset } from "@/components/ui/sidebar"
import { SidebarGridProvider } from "@/components/ui/sidebar-grid-provider"
import { getCliCommandTocSections } from "@/lib/cli-commands"
import {
  getCollectionNavigation,
  getFavoriteNavigationItems,
} from "@/lib/navigation"
import { cn } from "@/lib/utils"
import type { frontmatterSchema } from "@/validations"

function createDocsLayoutConfig(input: {
  layoutWidth: string
  sidebarMinWidth: string
  sidebarPreferredWidth: string
  sidebarMaxWidth: string
  tocContentWidth: string
  tocPaddingX?: string
  tocBorderWidth?: string
}) {
  const {
    layoutWidth,
    sidebarMinWidth,
    sidebarPreferredWidth,
    sidebarMaxWidth,
    tocContentWidth,
    tocPaddingX = "1.5rem",
    tocBorderWidth = "1px",
  } = input

  return {
    cssVars: {
      "--docs-content-track-width":
        "minmax(0, calc(var(--docs-layout-width) - var(--docs-sidebar-track-width) - var(--docs-toc-width)))",
      "--docs-gutter-width": `clamp(0px, calc((100vw - var(--docs-layout-width)) / 2), calc(var(--docs-layout-width)))`,
      "--docs-layout-width": layoutWidth,
      "--docs-left-rail-width":
        "calc(var(--docs-gutter-width) + var(--docs-sidebar-track-width))",
      "--docs-sidebar-track-width": `clamp(${sidebarMinWidth}, ${sidebarPreferredWidth}, ${sidebarMaxWidth})`,
      "--docs-toc-border-width": tocBorderWidth,
      "--docs-toc-content-width": tocContentWidth,
      "--docs-toc-padding-x": tocPaddingX,
      "--docs-toc-width": `calc(var(--docs-toc-content-width) + (2 * var(--docs-toc-padding-x)) + var(--docs-toc-border-width))`,
    } as React.CSSProperties,
    layoutWidth,
    sidebarMaxWidth,
    sidebarMinWidth,
    sidebarPreferredWidth,
    tocBorderWidth,
    tocContentWidth,
    tocPaddingX,
  }
}

// Keep the previous 3-column docs shell semantics, just without parallel routes.
const DOCS_LAYOUT = createDocsLayoutConfig({
  layoutWidth: "100rem",
  sidebarMaxWidth: "300px",
  sidebarMinWidth: "250px",
  sidebarPreferredWidth: "260px",
  tocBorderWidth: "0px",
  tocContentWidth: "250px",
})

async function fetchApiReferenceSources(
  references: z.infer<typeof frontmatterSchema>["apiReference"]
) {
  return getApiReferenceExports(references)
}

function flatExportsToTocItems(
  exports: ApiReferenceResult["exports"],
  baseDepth: number
) {
  return exports.map((exp) => ({
    id: exp.slug,
    title: exp.title,
    depth: baseDepth,
    ...(exp.kind
      ? {
          jsx: (
            <span className="inline-flex items-center gap-1.5">
              <span className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[10px] leading-none font-medium">
                {exp.kind.charAt(0)}
              </span>
              <span>{exp.title}</span>
            </span>
          ),
        }
      : {}),
    ...(exp.methods?.length
      ? {
          children: exp.methods.map((m) => ({
            id: m.slug,
            title: m.title,
            depth: baseDepth,
            jsx: <span className="ml-4">{m.title}</span>,
          })),
        }
      : {}),
  }))
}

export default async function DocsSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const docsLayoutVars = DOCS_LAYOUT.cssVars
  const docsGridClasses = cn(
    "relative z-10 overflow-x-clip",
    // Default desktop grid: left gutter, sidebar, content, toc, right gutter.
    "xl:grid-cols-[minmax(min-content,1fr)_var(--docs-sidebar-track-width)_var(--docs-content-track-width)_var(--docs-toc-width)_minmax(min-content,1fr)]",
    // Offcanvas desktop grid: keep content + TOC centered when the sidebar collapses.
    "has-data-[collapsible=offcanvas]:xl:grid-cols-[minmax(min-content,1fr)_0_var(--docs-content-track-width)_var(--docs-toc-width)_minmax(min-content,1fr)]"
  )

  const [collection] = slug

  if (!collection) {
    return null
  }

  const [availableCollections, entry, navigationItems, breadcrumbItems] =
    await Promise.all([
      rootCollections(),
      getDocumentationEntryBySlug(slug),
      getCollectionNavigation(collection),
      getBreadcrumbItems(slug),
    ])

  const currentCollection = availableCollections.find(
    (item) => item.group === collection
  )
  const favoriteItems = getFavoriteNavigationItems(navigationItems)

  let headings: ContentSection[] = []

  if (isFile(entry)) {
    const fileContent = await getFileContent(entry)
    const frontmatter = await getMetadata(fileContent)
    headings = (await fileContent?.getSections()) ?? []

    if (frontmatter?.apiReference && frontmatter.apiReference.length > 0) {
      const results = await fetchApiReferenceSources(frontmatter.apiReference)
      const hasMultipleSources = results.length > 1
      const referenceSections = hasMultipleSources
        ? results.map((result) => ({
            id: result.name.replaceAll(/[^a-z0-9-]/gu, "-"),
            title: result.name,
            depth: 3,
            children: flatExportsToTocItems(result.exports, 4),
          }))
        : flatExportsToTocItems(
            results.flatMap((r) => r.exports),
            3
          )

      headings = [
        ...headings,

        ...(referenceSections.length
          ? [
              {
                id: "api-reference",
                title: "API Reference",
                depth: 2,
                children: referenceSections,
              },
            ]
          : []),
      ]
    }

    if (frontmatter?.cliCommand) {
      const cliSections = getCliCommandTocSections(frontmatter.cliCommand)
      // Replace any static "Options"/"Arguments" headings from the MDX
      // with the dynamic ones that have individual items as children
      headings = [
        ...headings.filter((h) => h.id !== "options" && h.id !== "arguments"),
        ...cliSections,
      ]
    }
  }

  return (
    <div className="relative w-full" style={docsLayoutVars}>
      <TableOfContentsScript />
      <SidebarGridProvider
        sidebarMinWidth={DOCS_LAYOUT.sidebarMinWidth}
        sidebarMaxWidth={DOCS_LAYOUT.sidebarMaxWidth}
        style={
          {
            "--sidebar-grid-preferred": DOCS_LAYOUT.sidebarPreferredWidth,
          } as React.CSSProperties
        }
        className={docsGridClasses}
      >
        <DocsLeftRailBackground />
        <DocsSidebar
          wrapperClassName="xl:col-start-2"
          favoriteItems={favoriteItems}
          navigationItems={navigationItems}
          collectionChooser={
            <CollectionChooser
              currentCollection={currentCollection}
              collections={availableCollections}
            />
          }
        />
        <SidebarToggle />
        <SidebarInset className="min-w-0 xl:col-start-3">
          <MobileDocsHeader />
          {headings.length > 0 && <MobileTableOfContents sections={headings} />}
          <div className="px-4 py-8 md:px-8">
            <main className="w-full min-w-0 xl:mx-auto xl:max-w-225">
              <SiteBreadcrumb items={breadcrumbItems} />
              {children}
            </main>
          </div>
        </SidebarInset>
        <aside
          className="hidden border-l py-8 pr-(--docs-toc-padding-x) xl:col-start-4 xl:block"
          style={{ borderLeftWidth: "var(--docs-toc-border-width)" }}
        >
          {headings.length > 0 && <TableOfContents sections={headings} />}
        </aside>
      </SidebarGridProvider>
    </div>
  )
}
