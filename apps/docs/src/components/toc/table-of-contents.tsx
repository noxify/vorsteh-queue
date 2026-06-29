import NextScript from "next/script"
import React, { useId } from "react"
import type { ContentSection, Section } from "renoun"

import { Register } from "./register"
import tocScript from "./script"

/** A section for the table of contents (either Section or ContentSection). */
export type TableOfContentsSection = Section | ContentSection

export interface TableOfContentsComponents {
  /** Root navigation element. */
  Root: React.ComponentType<{
    children?: React.ReactNode
    "aria-labelledby"?: string
  }>

  /** Title heading. */
  Title: React.ComponentType<{
    id?: string
    children?: React.ReactNode
  }>

  /** Ordered list of items. */
  List: React.ComponentType<{
    depth: number
    children?: React.ReactNode
  }>

  /** Individual list item. */
  Item: React.ComponentType<{
    children?: React.ReactNode
  }>

  /** Anchor link to a heading. */
  Link: React.ComponentType<{
    children?: React.ReactNode
    href: string
    suppressHydrationWarning?: boolean
    "aria-current"?: React.AriaAttributes["aria-current"]
  }>
}

export interface TableOfContentsProps {
  /** The sections to display within the table of contents. */
  sections: TableOfContentsSection[]

  /** Override the default component renderers. */
  components?: Partial<TableOfContentsComponents>

  /** Optional content rendered after the section links. */
  children?: React.ReactNode
}

const defaultComponents: TableOfContentsComponents = {
  Item: (props) => <li {...props} />,
  // oxlint-disable-next-line jsx-a11y/anchor-has-content
  Link: (props) => <a {...props} />,
  List: (props) => <ol {...props} />,
  Root: (props) => <nav {...props} />,
  Title: ({ children = "On this page", ...props }) => (
    <h4 {...props}>{children}</h4>
  ),
}

/**
 * Script to manage active heading state in the table of contents.
 * @internal
 */
export function TableOfContentsScript({ nonce }: { nonce?: string }) {
  const code = `void (${Function.prototype.toString.call(tocScript)})(${JSON.stringify({ activationRatio: 0.333 })});`

  return (
    <NextScript
      id="renoun-toc-script"
      nonce={nonce}
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: code.replaceAll(/<\/script/giu, "<\\/script"),
      }}
    />
  )
}

/** Check if a section has a depth property (is ContentSection). */
function hasDepth(section: TableOfContentsSection): section is ContentSection {
  return "depth" in section && typeof section.depth === "number"
}

/** Collect all section IDs recursively. */
function collectSectionIds(
  sections: TableOfContentsSection[],
  ids: Set<string>
): void {
  for (const section of sections) {
    ids.add(section.id)
    if (section.children) {
      collectSectionIds(section.children, ids)
    }
  }
}

/** Render nested sections. */
function renderSections(
  sections: TableOfContentsSection[],
  depth: number,
  components: {
    List: TableOfContentsComponents["List"]
    Item: TableOfContentsComponents["Item"]
    Link: TableOfContentsComponents["Link"]
  }
): React.ReactNode {
  if (sections.length === 0) {
    return null
  }
  const { List, Item, Link } = components
  return (
    <List depth={depth}>
      {sections.map((section) => (
        <Item key={section.id}>
          <Link href={`#${section.id}`} suppressHydrationWarning>
            {"jsx" in section && section.jsx !== undefined
              ? section.jsx
              : section.title}
          </Link>
          {section.children && section.children.length > 0
            ? renderSections(section.children, depth + 1, components)
            : null}
        </Item>
      ))}
    </List>
  )
}

/** A table of contents that displays links to the sections in the current document. */
export function TableOfContents({
  sections,
  // oxlint-disable-next-line react/no-object-type-as-default-prop
  components = {},
  children,
}: TableOfContentsProps) {
  const rootId = useId()
  const sectionIds = new Set<string>()
  const { Root, Title, List, Item, Link }: TableOfContentsComponents = {
    ...defaultComponents,
    ...components,
  }

  // Filter to only show sections with depth > 1 (skip h1) for ContentSection,
  // or include all sections for Section (no depth property)
  const filteredSections = sections.filter(
    (section) => !hasDepth(section) || section.depth > 1
  )

  // Collect all section IDs for scroll tracking
  collectSectionIds(filteredSections, sectionIds)

  if (filteredSections.length === 0 && !children) {
    return null
  }

  return (
    <Root aria-labelledby={rootId}>
      <Title id={rootId} />
      {renderSections(filteredSections, 0, { Item, Link, List })}
      {children}
      <Register ids={[...sectionIds]} />
    </Root>
  )
}
