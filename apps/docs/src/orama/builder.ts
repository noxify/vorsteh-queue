import path from "node:path"

import type { Ora } from "ora"
import pMap from "p-map"
import { isDirectory, isFile } from "renoun/file-system"

import {
  getFileContent,
  getBreadcrumbItems,
  getMetadata,
  getTitle,
  isExternal,
  isHidden,
} from "@/collection-helpers"
import type { EntryType } from "@/collection-helpers"
import { AllDocumentation } from "@/collections"
/**
 * Holt alle Einträge, die für den Search-Index relevant sind (wie im Build-Skript).
 */
export async function getAllSearchableEntries() {
  const tree = await AllDocumentation.getTree({
    includeIndexAndReadmeFiles: true,
  })
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
  return flattenEntries(rootEntries).filter(
    (entry) => !isDirectory(entry) || (isDirectory(entry) && isFile(entry))
  )
}

export type DocumentType = "page" | "heading" | "text"

export interface OramaDocument {
  id: string
  page_id: string
  type: DocumentType
  title: string
  section: string
  heading: string
  content: string
  url: string
  breadcrumb: string
}

export interface HeadingSection {
  id: string
  title: string
  depth: number
}

export function flattenEntries(entries: EntryType[]): EntryType[] {
  const seen = new Set<string>()
  const result: EntryType[] = []

  for (const entry of entries) {
    if (isHidden(entry) || isExternal(entry)) {
      continue
    }

    if (
      isFile(entry) &&
      (entry.baseName === "index" || entry.baseName === "readme")
    ) {
      continue
    }

    const pathname = entry.getPathname({ includeBasePathname: true })
    if (seen.has(pathname)) {
      continue
    }

    seen.add(pathname)
    result.push(entry)
  }

  return result
}

export function cleanMdxContent(input: string): string {
  return input
    .replace(/^---[\s\S]*?---\s*/mu, "")
    .replaceAll(/```[\s\S]*?```/gu, " ")
    .replaceAll(/`[^`]*`/gu, " ")
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replaceAll(/\[(?<text>[^\]]+)\]\((?<url>[^)]+)\)/gu, "$<text>")
    .replaceAll(/<[^>]+>/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
}

export function normalizeHeadingTitle(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/gu, " ")
}

export function splitContentByHeadings(
  rawContent: string,
  sections: HeadingSection[]
): { heading: HeadingSection | null; content: string }[] {
  const withoutFrontmatter = rawContent.replace(/^---[\s\S]*?---\s*/mu, "")
  const lines = withoutFrontmatter.split(/\r?\n/u)
  const headingLineRegex = /^(?<hashes>#{2,6})\s+(?<title>.+?)\s*$/u
  const headingMatches: { lineIndex: number; title: string }[] = []

  for (const [index, line] of lines.entries()) {
    const match = headingLineRegex.exec(line)
    if (!match?.groups?.title) {
      continue
    }

    headingMatches.push({ lineIndex: index, title: match.groups.title.trim() })
  }

  if (headingMatches.length === 0) {
    return [{ heading: null, content: withoutFrontmatter }]
  }

  const normalizedSectionMap = new Map<string, HeadingSection[]>()
  for (const section of sections) {
    const key = normalizeHeadingTitle(section.title)
    const existing = normalizedSectionMap.get(key) ?? []
    existing.push(section)
    normalizedSectionMap.set(key, existing)
  }

  const chunks: { heading: HeadingSection | null; content: string }[] = []
  const [firstHeadingMatch] = headingMatches
  if (!firstHeadingMatch) {
    return [{ heading: null, content: withoutFrontmatter }]
  }

  const introLines = lines.slice(0, firstHeadingMatch.lineIndex)
  if (introLines.length > 0) {
    chunks.push({ heading: null, content: introLines.join("\n") })
  }

  for (const [index, match] of headingMatches.entries()) {
    const start = match.lineIndex
    const nextHeadingMatch = headingMatches[index + 1]
    const end =
      index < headingMatches.length - 1 && nextHeadingMatch
        ? nextHeadingMatch.lineIndex
        : lines.length
    const chunkLines = lines.slice(start, end)
    const chunkContent = chunkLines.join("\n")

    const key = normalizeHeadingTitle(match.title)
    const matchingSections = normalizedSectionMap.get(key)
    const heading = matchingSections?.shift() ?? null

    chunks.push({ heading, content: chunkContent })
  }

  return chunks
}

export function toPathname(entry: EntryType): string {
  const segments = entry.getPathnameSegments({ includeBasePathname: true })
  return `/${path.join("docs", ...segments)}/`
}

export async function buildSearchDocuments(
  entries: EntryType[],
  spinner?: Ora
) {
  let processed = 0
  const allDocs: OramaDocument[] = []

  await pMap(
    entries,
    async (entry) => {
      const file = await getFileContent(entry)
      if (!file) {
        return
      }

      const [metadata, rawContent, rawSections] = await Promise.all([
        getMetadata(file),
        file.getText(),
        file.getSections().catch(() => null),
      ])
      const sections = (rawSections ?? []).filter(
        (section): section is HeadingSection =>
          typeof section.id === "string" &&
          typeof section.title === "string" &&
          typeof section.depth === "number"
      )

      processed += 1
      if (spinner && (processed % 25 === 0 || processed === entries.length)) {
        spinner.text = `Preparing docs ${processed}/${entries.length}...`
      }

      const pathname = toPathname(entry)
      const slugSegments = entry.getPathnameSegments({
        includeBasePathname: true,
      })
      const breadcrumbItems = await getBreadcrumbItems(slugSegments)
      const title = getTitle(entry, metadata, true)
      const sectionName = slugSegments[0] ?? "docs"
      const breadcrumbStr =
        breadcrumbItems.map((item) => item.title).join(" > ") ||
        slugSegments.join(" > ")

      let chunkId = 0
      const nextId = () => {
        const id = `${pathname}-${chunkId}`
        chunkId += 1
        return id
      }

      // Page document (title + description)
      allDocs.push({
        id: pathname,
        page_id: pathname,
        type: "page",
        title,
        section: sectionName,
        heading: "",
        content: metadata?.description ?? title,
        url: pathname,
        breadcrumb: breadcrumbStr,
      })

      // Heading documents
      for (const s of sections) {
        allDocs.push({
          id: nextId(),
          page_id: pathname,
          type: "heading",
          title,
          section: sectionName,
          heading: s.title,
          content: s.title,
          url: `${pathname}#${s.id}`,
          breadcrumb: breadcrumbStr,
        })
      }

      // Section text documents (one chunk per heading block)
      const contentChunks = splitContentByHeadings(rawContent, sections)
      for (const chunk of contentChunks) {
        const cleaned = cleanMdxContent(chunk.content)
        if (!cleaned) {
          continue
        }

        allDocs.push({
          id: nextId(),
          page_id: pathname,
          type: "text",
          title,
          section: sectionName,
          heading: chunk.heading?.title ?? "",
          content: cleaned,
          url: chunk.heading ? `${pathname}#${chunk.heading.id}` : pathname,
          breadcrumb: breadcrumbStr,
        })
      }
    },
    { concurrency: 8 }
  )

  return allDocs
}
