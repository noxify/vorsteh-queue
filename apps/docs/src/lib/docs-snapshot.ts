import { env } from "node:process"

import { createSlug } from "renoun"
import { isFile } from "renoun/file-system"

import {
  getEntryFrontmatter,
  getFileContent,
  isHidden,
} from "@/collection-helpers"
import type { EntryType } from "@/collection-helpers"
import { AllDocumentation, availableCollections } from "@/collections"
import type { AvailableCollection } from "@/collections"

type DocumentType =
  | "overview"
  | "guide"
  | "reference"
  | "component"
  | "tutorial"
  | "unknown"

interface Heading {
  level: number
  text: string
  id: string
}

interface SnapshotRecord {
  schemaVersion: "1.0.0"
  docId: string
  source: AvailableCollection
  slug: string
  path: string
  raw_path: string
  title: string
  headings: Heading[]
  documentType: DocumentType
  contentOrigin: "static-doc"
  canonicalUrl: string
  buildId: string
  generatedAt: string
  content: string
  description?: string
  navTitle?: string
  tags?: string[]
  keywords?: string[]
}

interface HeadingSection {
  id: string
  title: string
  depth: number
}

function normalizeInternalHref(href: string): string {
  if (href === "/") {
    return href
  }

  const [rawPathWithQuery = "", hash = ""] = href.split("#")
  const [pathname = "", search = ""] = rawPathWithQuery.split("?")

  if (!pathname || pathname.endsWith("/") || /\.[a-z0-9]+$/iu.test(pathname)) {
    return href
  }

  const normalizedPathname = `${pathname}/`
  const normalizedSearch = search ? `?${search}` : ""
  const normalizedHash = hash ? `#${hash}` : ""

  return `${normalizedPathname}${normalizedSearch}${normalizedHash}`
}

function mapSectionsToHeadings(sections: HeadingSection[]): Heading[] {
  return sections.map((section) => ({
    level: section.depth,
    text: section.title,
    id: section.id,
  }))
}

function classifyDocumentType(filepath: string): DocumentType {
  const lowerPath = filepath.toLowerCase()

  if (
    lowerPath.includes("/introduction/") ||
    lowerPath.endsWith("/index.mdx")
  ) {
    return "overview"
  }

  if (
    lowerPath.includes("/getting-started/") ||
    lowerPath.includes("/guides/")
  ) {
    return "guide"
  }

  if (lowerPath.includes("/api/")) {
    return "reference"
  }

  if (lowerPath.includes("/components/")) {
    return "component"
  }

  if (
    lowerPath.includes("/first-steps/") ||
    lowerPath.includes("/second-steps/")
  ) {
    return "tutorial"
  }

  return "unknown"
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/\s+/u)
    .map((word) => word.replaceAll(/[^\p{L}\p{N}-]/gu, ""))
    .filter((word) => word.length > 4)

  const frequencies = new Map<string, number>()

  for (const word of words) {
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1)
  }

  return [...frequencies.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const result = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)

  return result.length > 0 ? result : undefined
}

function getEntryRelativePath(entry: EntryType): string | undefined {
  if ("relativePath" in entry && typeof entry.relativePath === "string") {
    return entry.relativePath.replaceAll("\\", "/")
  }

  return undefined
}

function stripOrderingPrefix(segment: string): string {
  return segment.replace(/^\d+\./u, "")
}

function getSlugFromRelativePath(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.mdx$/u, "")
  const segments = withoutExtension
    .split("/")
    .filter(Boolean)
    .map((segment) => createSlug(stripOrderingPrefix(segment)))

  const lastSegment = segments.at(-1)
  if (lastSegment === "index") {
    segments.pop()
  }

  return segments.join("/")
}

function getEntryPathname(entry: EntryType): string {
  if ("pathname" in entry && typeof entry.pathname === "string") {
    return entry.pathname
  }

  return entry.getPathname({ includeBasePathname: true })
}

function toCanonicalUrl(pathname: string): string {
  const normalized = pathname.replaceAll("\\", "/")
  const withoutLeadingSlash = normalized.replaceAll(/^\/+|\/+$/gu, "")

  if (withoutLeadingSlash.endsWith("/index")) {
    return normalizeInternalHref(`/docs/${withoutLeadingSlash.slice(0, -6)}`)
  }

  if (withoutLeadingSlash === "index") {
    return "/docs"
  }

  return normalizeInternalHref(`/docs/${withoutLeadingSlash}`)
}

function toRawPath(pathname: string): string {
  const normalized = pathname.replaceAll("\\", "/")
  const withoutLeadingSlash = normalized.replaceAll(/^\/+|\/+$/gu, "")

  if (!withoutLeadingSlash) {
    return "/raw"
  }

  const segments = withoutLeadingSlash.split("/")
  const lastSegment = segments.at(-1)

  if (!lastSegment) {
    return "/raw"
  }

  segments[segments.length - 1] = `${lastSegment}.md`
  return `/raw/${segments.join("/")}`
}

function toDocsPath(pathname: string): string {
  const normalized = pathname.replaceAll("\\", "/")
  const withLeadingSlash = normalized.startsWith("/")
    ? normalized
    : `/${normalized}`

  return `/docs${withLeadingSlash}`
}

function toSlugFallbackFromDocId(docId: string): string {
  return docId.replace(/\/index$/u, "")
}

async function buildRecord(
  entry: EntryType,
  generatedAt: string,
  buildId: string
): Promise<SnapshotRecord | null> {
  const slugSegments = entry.getPathnameSegments({
    includeBasePathname: true,
  })
  const [source] = slugSegments

  if (
    !source ||
    !availableCollections.includes(source as AvailableCollection)
  ) {
    return null
  }

  const relPath = getEntryRelativePath(entry)
  if (!relPath) {
    return null
  }

  const frontmatter = await getEntryFrontmatter(entry)
  const file = await getFileContent(entry)

  if (!file) {
    return null
  }

  const [body, rawSections] = await Promise.all([
    file.getText(),
    file.getSections().catch(() => null),
  ])
  const sections = (rawSections ?? []).filter(
    (section): section is HeadingSection =>
      typeof section.id === "string" &&
      typeof section.title === "string" &&
      typeof section.depth === "number"
  )

  const titleValue =
    typeof frontmatter?.title === "string"
      ? frontmatter.title
      : typeof frontmatter?.navTitle === "string"
        ? frontmatter.navTitle
        : undefined

  const title = titleValue?.trim()
  if (!title) {
    return null
  }

  const slug = getSlugFromRelativePath(relPath)
  const description =
    typeof frontmatter?.description === "string"
      ? frontmatter.description.trim()
      : undefined
  const sourceCollection = source as AvailableCollection
  const pathname = getEntryPathname(entry)
  const docId = pathname.replace(/^\//u, "")
  const normalizedSlug = slug || toSlugFallbackFromDocId(docId)
  const tags = toStringArray(frontmatter?.tags)
  const keywordInput = [
    title,
    description ?? "",
    ...sections.map((section) => section.title),
    ...(tags ?? []),
  ].join(" ")

  return {
    schemaVersion: "1.0.0",
    docId,
    source: sourceCollection,
    slug: normalizedSlug,
    path: toDocsPath(pathname),
    raw_path: toRawPath(pathname),
    title,
    headings: mapSectionsToHeadings(sections),
    documentType: classifyDocumentType(relPath),
    contentOrigin: "static-doc",
    canonicalUrl: toCanonicalUrl(pathname),
    buildId,
    generatedAt,
    content: body,
    description,
    navTitle:
      typeof frontmatter?.navTitle === "string"
        ? frontmatter.navTitle.trim()
        : undefined,
    tags,
    keywords: extractKeywords(keywordInput),
  }
}

function resolveBuildId(): string {
  return env.CI_PIPELINE_ID ?? env.CI_JOB_ID ?? `local-${Date.now()}`
}

export interface BuildSnapshotOptions {
  collection?: AvailableCollection
}

async function getSnapshotEntries(
  options: BuildSnapshotOptions = {}
): Promise<EntryType[]> {
  const tree = await AllDocumentation.getTree({
    includeIndexAndReadmeFiles: true,
  })
  const targetCollection = options.collection

  const rootEntries = tree.flatMap((node) => {
    const all = [node.entry]
    if (!node.children) {
      return all
    }

    const walk = (children: typeof node.children) => {
      for (const child of children) {
        all.push(child.entry)
        if (child.children) {
          walk(child.children)
        }
      }
    }

    walk(node.children)
    return all
  })

  const seen = new Set<string>()

  return rootEntries
    .filter((entry) => isFile(entry) && !isHidden(entry))
    .filter((entry) => {
      const pathname = entry.getPathname({ includeBasePathname: true })
      if (seen.has(pathname)) {
        return false
      }

      seen.add(pathname)
      return true
    })
    .filter((entry) => {
      if (!targetCollection) {
        return true
      }
      const [source] = entry.getPathnameSegments({
        includeBasePathname: true,
      })
      return source === targetCollection
    })
    .toSorted((a, b) => {
      const left = a.getPathname({ includeBasePathname: true })
      const right = b.getPathname({ includeBasePathname: true })
      return left.localeCompare(right)
    })
}

async function buildDocsSnapshotLines(
  options: BuildSnapshotOptions = {}
): Promise<string[]> {
  const generatedAt = new Date().toISOString()
  const buildId = resolveBuildId()
  const entries = await getSnapshotEntries(options)

  const lines: string[] = []

  for (const entry of entries) {
    // oxlint-disable-next-line no-await-in-loop
    const record = await buildRecord(entry, generatedAt, buildId)
    if (!record) {
      continue
    }
    lines.push(JSON.stringify(record))
  }

  return lines
}

export async function buildDocsSnapshotJsonl(
  options: BuildSnapshotOptions = {}
): Promise<string> {
  const lines = await buildDocsSnapshotLines(options)
  return lines.join("\n")
}
