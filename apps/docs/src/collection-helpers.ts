import path from "node:path"

import { cache } from "react"
import type { ModuleExport } from "renoun/file-system"
import { isDirectory, isFile } from "renoun/file-system"
import type { z } from "zod"

import { cachePromise } from "@/lib/cache-promise"

import { AllDocumentation, PackagesDirectory } from "./collections"
import type { frontmatterSchema } from "./validations"

export interface LlmsTreeItem {
  title: string
  description: string | undefined
  docsHref: string
  rawHref: string
  isDirectory: boolean
  children: LlmsTreeItem[]
}

type TreeNode = Awaited<ReturnType<typeof AllDocumentation.getTree>>[number]

type CollectionHelperGlobals = typeof globalThis & {
  __docsRootCollectionsPromise?: Promise<
    {
      description: string | undefined
      entrypoint: string
      group: string
      title: string
    }[]
  >
  __docsEntryFrontmatterCache?: Map<string, Promise<Frontmatter | undefined>>
}

const collectionHelperGlobals = globalThis as CollectionHelperGlobals

export type Frontmatter = z.infer<typeof frontmatterSchema>
export interface TransformedEntry {
  group: string
  fullPathname: string
  relativePathname: string
  segments: string[]
  title: string
  description?: string
  path: string
  isDirectory: boolean
  sortOrder: number
  depth: number
  baseName: string
  hasFile: boolean
}

export interface BreadcrumbItem {
  title: string
  path: string[]
}

export interface BreadcrumbEntry {
  pathname: string
  segments: string[]
  breadcrumbTitle: string
  pageTitle: string
}

export interface ResolvedDocEntry {
  entry: EntryType
  frontmatter?: Frontmatter
  title: string
}

export type EntryType = Awaited<ReturnType<typeof AllDocumentation.getEntry>>

/**
 * Build-scope cache for slug -> entry resolution.
 *
 * Why this exists in addition to React `cache()`:
 * - `cache()` dedupes inside one render/request boundary.
 * - Static export triggers many independent boundaries (layout, page, metadata).
 * - This Map keeps a shared Promise for the whole Node.js build process,
 *   so repeated lookups for the same slug are resolved once.
 */
const _documentationEntryBySlugCache = new Map<string, Promise<EntryType>>()

const getDocumentationEntryBySlugCached = cache(async (slugKey: string) =>
  cachePromise(_documentationEntryBySlugCache, slugKey, async () => {
    const segments = slugKey ? slugKey.split("/") : []
    return AllDocumentation.getEntry(segments)
  })
)

export async function getDocumentationEntryBySlug(slug: string[]) {
  return getDocumentationEntryBySlugCached(slug.join("/"))
}

let _rootCollectionsPromise: Promise<
  {
    description: string | undefined
    entrypoint: string
    group: string
    title: string
  }[]
> | null = collectionHelperGlobals.__docsRootCollectionsPromise ?? null

export const rootCollections = cache(async () => {
  if (!_rootCollectionsPromise) {
    _rootCollectionsPromise = (async () => {
      const collections = AllDocumentation.getRootEntries()

      return await Promise.all(
        collections.map(async (entry) => {
          const metadata = await getEntryFrontmatter(entry)

          return {
            description: metadata?.description,
            entrypoint:
              metadata?.entrypoint ??
              `/${path.join("docs", ...entry.getPathnameSegments({ includeBasePathname: true }))}`,
            group: entry.name,
            title: metadata ? getTitle(entry, metadata, true) : entry.title,
          }
        })
      )
    })()

    collectionHelperGlobals.__docsRootCollectionsPromise =
      _rootCollectionsPromise
  }

  return _rootCollectionsPromise
})

const getFileContentByPathCached = cache(async (segmentsKey: string) => {
  const segments = segmentsKey.split("/")

  const [segmentFile, indexFile, readmeFile] = await Promise.all([
    AllDocumentation.getFile(segments, "mdx").catch(() => null),
    AllDocumentation.getFile([...segments, "index"], "mdx").catch(() => null),
    AllDocumentation.getFile([...segments, "readme"], "mdx").catch(() => null),
  ])

  const returnedPath =
    readmeFile?.getPathname({ includeBasePathname: true }) ??
    indexFile?.getPathname({ includeBasePathname: true }) ??
    segmentFile?.getPathname({ includeBasePathname: true })

  if (returnedPath !== `/${segmentsKey}`) {
    return null
  }

  return segmentFile ?? indexFile ?? readmeFile ?? null
})

export async function getFileContent(source: EntryType) {
  const segments = source.getPathnameSegments({
    includeBasePathname: true,
    includeDirectoryNamedSegment: true,
  })

  return getFileContentByPathCached(segments.join("/"))
}

export async function getMetadata(
  file: Awaited<ReturnType<typeof getFileContent>>
) {
  return (await file?.getExportValue("frontmatter")) ?? undefined
}

function isIndexOrReadmeEntry(entry: EntryType) {
  return (
    isFile(entry) && (entry.baseName === "index" || entry.baseName === "readme")
  )
}

export function getCanonicalEntry(entry: EntryType): EntryType {
  return isIndexOrReadmeEntry(entry) ? entry.getParent() : entry
}

type EntryWithStructure = EntryType & {
  getStructure?: () => unknown | Promise<unknown>
}

async function resolveEntryWithStructure(entry: EntryType) {
  const entryWithStructure = entry as EntryWithStructure

  if (typeof entryWithStructure.getStructure === "function") {
    return entry
  }

  const resolved = await AllDocumentation.getEntry(
    entry.getPathnameSegments({ includeBasePathname: true })
  )

  return resolved ?? entry
}

function readFrontmatterFromStructure(structure: unknown) {
  const nodes = Array.isArray(structure) ? structure : [structure]
  const orderedNodes = Array.isArray(structure)
    ? nodes.filter((node) => {
        if (typeof node !== "object" || node === null) {
          return false
        }

        const maybeBaseName = (node as { baseName?: unknown }).baseName
        return maybeBaseName === "index" || maybeBaseName === "readme"
      })
    : nodes

  for (const node of orderedNodes) {
    if (
      typeof node === "object" &&
      node !== null &&
      "frontmatter" in node &&
      (node as { frontmatter?: Frontmatter }).frontmatter
    ) {
      return (node as { frontmatter?: Frontmatter }).frontmatter
    }
  }
}

async function getFrontmatterFromStructure(entry: EntryType) {
  if (isFile(entry)) {
    const file = await getFileContent(entry)
    return getMetadata(file)
  }

  const resolvedEntry = await resolveEntryWithStructure(entry)
  const entryWithStructure = resolvedEntry as EntryWithStructure

  if (typeof entryWithStructure.getStructure !== "function") {
    return
  }

  const structure = await entryWithStructure.getStructure()
  return readFrontmatterFromStructure(structure)
}

/**
 * Build-scope cache for expensive frontmatter resolution.
 *
 * A single entry's frontmatter can be requested from navigation, breadcrumbs,
 * metadata generation and llms/raw helpers during one build. Keeping the
 * in-flight Promise avoids repeated filesystem/tree traversals.
 */
const _entryFrontmatterCache = new Map<
  string,
  Promise<Frontmatter | undefined>
>()

const _sharedEntryFrontmatterCache =
  (collectionHelperGlobals.__docsEntryFrontmatterCache ??=
    _entryFrontmatterCache)

export async function getEntryFrontmatter(entry: EntryType) {
  const cacheKey = entry.getPathname({ includeBasePathname: true })
  return cachePromise(_sharedEntryFrontmatterCache, cacheKey, async () => {
    if (isDirectory(entry)) {
      const segments = entry.getPathnameSegments({ includeBasePathname: true })
      const [indexEntry, readmeEntry] = await Promise.all([
        AllDocumentation.getEntry([...segments, "index"]).catch(() => null),
        AllDocumentation.getEntry([...segments, "readme"]).catch(() => null),
      ])

      if (indexEntry) {
        const indexFrontmatter = await getFrontmatterFromStructure(indexEntry)
        if (indexFrontmatter) {
          return indexFrontmatter
        }
      }

      if (readmeEntry) {
        return getFrontmatterFromStructure(readmeEntry)
      }

      // oxlint-disable-next-line unicorn/no-useless-undefined
      return undefined
    }

    const directFrontmatter = await getFrontmatterFromStructure(entry)

    if (directFrontmatter) {
      return directFrontmatter
    }

    // oxlint-disable-next-line unicorn/no-useless-undefined
    return undefined
  })
}

export async function resolveDocEntry(
  entry: EntryType
): Promise<ResolvedDocEntry> {
  const canonicalEntry = getCanonicalEntry(entry)
  const frontmatter = await getEntryFrontmatter(entry)

  return {
    entry: canonicalEntry,
    frontmatter,
    title: getTitle(canonicalEntry, frontmatter, false),
  }
}

export function getTitle(
  entry: EntryType,
  frontmatter?: Frontmatter,
  includeTitle = false
): string {
  return includeTitle
    ? (frontmatter?.navTitle ?? frontmatter?.title ?? entry.title)
    : (frontmatter?.navTitle ?? entry.title)
}

/**
 * Returns sibling entries for rendering local section grids.
 *
 * For index files we resolve siblings from the parent directory so the index
 * route behaves like the directory route.
 */
export async function getSections(
  source: Awaited<ReturnType<typeof AllDocumentation.getEntry>>
) {
  if (source.depth > -1) {
    if (isDirectory(source)) {
      const directory = await AllDocumentation.getDirectory(
        source.getPathnameSegments({ includeBasePathname: true })
      )
      const parent = await directory.getEntries()
      return parent
    }

    if (isFile(source) && source.baseName === "index") {
      const directory = await AllDocumentation.getDirectory(
        source.getParent().getPathnameSegments({ includeBasePathname: true })
      )
      const parent = await directory.getEntries()
      return parent
    }
    return []
  }
  const directory = await AllDocumentation.getDirectory(
    source.getPathnameSegments({ includeBasePathname: true })
  )
  const parent = await directory.getEntries()
  return parent
}

export function getRootSections() {
  return AllDocumentation.getRootEntries() as EntryType[]
}

/**
 * Build-scope singleton for static route discovery.
 *
 * The docs tree scan is one of the most expensive operations in this app.
 * Reusing the Promise ensures all call sites (`generateStaticParams`, raw/llms
 * helpers, etc.) share one traversal during a build.
 */
let _staticRoutesPromise: Promise<string[][]> | null = null

export const staticRoutes = cache(async () => {
  if (!_staticRoutesPromise) {
    _staticRoutesPromise = (async () => {
      const rootEntries = await AllDocumentation.getTree({
        includeIndexAndReadmeFiles: true,
      })
      return parseTree(rootEntries)
    })()
  }
  return _staticRoutesPromise
})

async function parseTree(
  input: Awaited<ReturnType<typeof AllDocumentation.getTree>>,
  seen = new Set<string>()
) {
  const result: string[][] = []

  for (const node of input) {
    const segments = node.entry.getPathnameSegments({
      includeBasePathname: true,
    })
    const key = segments.join("/")

    if (!seen.has(key)) {
      seen.add(key)
      result.push(segments)
    }

    if (node.children) {
      // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- sequential processing intentional
      const childResults = await parseTree(node.children, seen)
      result.push(...childResults)
    }
  }
  return result
}

/**
 * Returns breadcrumb items for a slug, compatible with the POC API.
 *
 * @param slug page slug segments (e.g. ["vorsteh-queue", "components", "alerts"]).
 * @param allEntries optional pre-fetched breadcrumb entries to avoid repeated lookups.
 */
export async function getBreadcrumbItems(
  slug: string[] = []
): Promise<BreadcrumbItem[]> {
  const cacheKey = slug.join("/")
  return cachePromise(_breadcrumbItemsCache, cacheKey, async () => {
    // "index" should not appear as a visible breadcrumb element
    const cleanedSlug = slug.filter((segment) => segment !== "index")
    const combinations = cleanedSlug.map((_, idx) =>
      cleanedSlug.slice(0, idx + 1)
    )

    const entries = await Promise.all(
      combinations.map(async (segments) => {
        const entry = await getDocumentationEntryBySlug(segments)
        if (!entry) {
          return null
        }

        const resolved = await resolveDocEntry(entry)
        return {
          title: resolved.title,
          path: resolved.entry.getPathnameSegments({
            includeBasePathname: true,
          }),
        }
      })
    )

    return entries.filter((e): e is BreadcrumbItem => !!e)
  })
}

/**
 * Build-scope cache for breadcrumb computation by slug.
 *
 * Breadcrumbs are requested from both layout and metadata/page code paths.
 * Sharing the Promise keeps those repeated computations effectively O(1)
 * after the first request per slug.
 */
const _breadcrumbItemsCache = new Map<string, Promise<BreadcrumbItem[]>>()

/**
 * Flattens the docs tree into a de-duplicated navigation sequence.
 *
 * Index/readme nodes are skipped because they are represented by their parent
 * directory route in navigation and sibling resolution.
 */
function flattenTree(
  tree: Awaited<ReturnType<typeof AllDocumentation.getTree>>,
  seen = new Set<string>()
): EntryType[] {
  const result: EntryType[] = []
  for (const node of tree) {
    // Skip index/readme files – they are represented by their parent directory entry
    if (node.entry.baseName === "index" || node.entry.baseName === "readme") {
      if (node.children) {
        result.push(...flattenTree(node.children, seen))
      }
      continue
    }
    const pathname = node.entry.getPathname({ includeBasePathname: true })
    if (!seen.has(pathname)) {
      seen.add(pathname)
      result.push(node.entry)
    }
    if (node.children) {
      result.push(...flattenTree(node.children, seen))
    }
  }
  return result
}

/**
 * Resolves previous/next navigation entries based on the flattened visible tree.
 *
 * Index routes are compared against their parent directory pathname so docs
 * pages and directory routes share consistent sibling behavior.
 */
export async function getSiblings(
  source: EntryType
): Promise<[EntryType | undefined, EntryType | undefined]> {
  const tree = await AllDocumentation.getTree({
    includeIndexAndReadmeFiles: true,
  })
  const allEntries = flattenTree(tree)

  const visibleEntries = allEntries.filter(
    (entry) => !isHidden(entry) && !isExternal(entry)
  )

  // For index files, compare against the parent directory pathname
  const sourcePathname =
    isFile(source) && source.baseName === "index"
      ? source.getParent().getPathname({ includeBasePathname: true })
      : source.getPathname({ includeBasePathname: true })

  const currentIndex = visibleEntries.findIndex(
    (e) => e.getPathname({ includeBasePathname: true }) === sourcePathname
  )

  if (currentIndex === -1) {
    return [undefined, undefined]
  }

  return [
    currentIndex > 0 ? visibleEntries[currentIndex - 1] : undefined,
    currentIndex < visibleEntries.length - 1
      ? visibleEntries[currentIndex + 1]
      : undefined,
  ]
}

export function isHidden(
  entry: Awaited<ReturnType<typeof AllDocumentation.getEntry>>
) {
  return entry.baseName.startsWith("_")
}

export function isExternal(
  entry: Awaited<ReturnType<typeof AllDocumentation.getEntry>>
) {
  return entry.baseName.includes(".external")
}

async function mapLlmsTreeNode(
  node: TreeNode,
  parentDocsHref?: string
): Promise<LlmsTreeItem | null> {
  const { entry } = node

  if (isHidden(entry) || isExternal(entry)) {
    return null
  }

  const {
    entry: targetEntry,
    frontmatter,
    title,
  } = await resolveDocEntry(entry)
  const pathnameSegments = targetEntry.getPathnameSegments({
    includeBasePathname: true,
  })

  const docsHref = `/${["docs", ...pathnameSegments].join("/")}`
  const lastSegment = pathnameSegments.at(-1)
  const rawSlug =
    lastSegment === undefined
      ? pathnameSegments
      : [...pathnameSegments.slice(0, -1), `${lastSegment}.md`]
  const rawHref = `/${["raw", ...rawSlug].join("/")}`

  // Index/readme entries can canonicalize to the same path as their parent.
  // Skip these self-referential nodes to avoid duplicated subtrees in llms output.
  if (parentDocsHref && docsHref === parentDocsHref) {
    return null
  }

  const children: LlmsTreeItem[] = []
  const seenChildHrefs = new Set<string>()

  if (node.children) {
    for (const child of node.children) {
      // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- sequential processing intentional
      const mappedChild = await mapLlmsTreeNode(child, docsHref)

      if (!mappedChild || seenChildHrefs.has(mappedChild.docsHref)) {
        continue
      }

      seenChildHrefs.add(mappedChild.docsHref)
      children.push(mappedChild)
    }
  }

  return {
    title,
    description: frontmatter?.description,
    docsHref,
    rawHref,
    isDirectory: isDirectory(targetEntry),
    children,
  }
}

/**
 * Build-scope cache for llms tree generation per collection.
 *
 * `getCollectionLlmsTree` performs a full tree traversal + canonical mapping.
 * This cache ensures each collection is computed once and reused by both
 * collection-specific and aggregated llms endpoints.
 */
const _llmsTreeCache = new Map<string, Promise<LlmsTreeItem[]>>()

export async function getCollectionLlmsTree(
  collection: string // intentionally string, can be narrowed by consumer
): Promise<LlmsTreeItem[]> {
  return cachePromise(_llmsTreeCache, collection, async () => {
    const tree = await AllDocumentation.getTree({
      includeIndexAndReadmeFiles: true,
    })

    const rootNode = tree.find((node) => {
      const segments = node.entry.getPathnameSegments({
        includeBasePathname: true,
      })
      return segments[0] === collection
    })

    if (!rootNode) {
      return []
    }

    const mappedRoot = await mapLlmsTreeNode(rootNode)

    if (!mappedRoot) {
      return []
    }

    // Always expose the collection root once as top-level item.
    // Child self-references are already filtered in mapLlmsTreeNode.
    return [mappedRoot]
  })
}

/**
 * Build-scope cache for API reference export resolution.
 *
 * Each unique file path is resolved once and reused across all pages
 * that reference it in their `apiReference` frontmatter.
 */
const _apiReferenceCache = new Map<string, Promise<ApiReferenceResult | null>>()

export interface ApiReferenceResult {
  name: string
  exports: {
    slug: string
    name: string
    title: string
    kind: string | null
    methods?: { slug: string; name: string; title: string }[]
  }[]
}

// copied from https://github.com/souporserious/renoun/blob/main/packages/renoun/src/components/Reference/Reference.tsx#L3629
export function kindToLabel(kind: string): string {
  return kind.replaceAll(
    /(?<lower>[a-z])(?<upper>[A-Z])/gu,
    "$<lower> $<upper>"
  )
}

export const getApiReferenceExports = cache(
  async (
    references: { name: string; file: string }[]
  ): Promise<ApiReferenceResult[]> => {
    const results = await Promise.all(
      references.map((ref) =>
        cachePromise(_apiReferenceCache, ref.file, async () => {
          try {
            const sourceFile = await PackagesDirectory.getFile(ref.file, "ts")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fileExports = await (sourceFile as any).getExports()
            const exports = await Promise.all(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (fileExports as ModuleExport<any>[]).map(async (e) => {
                const typeInfo = await e.getType()
                const methods =
                  typeInfo?.kind === "Class" && typeInfo.methods
                    ? // oxlint-disable-next-line react-doctor/js-combine-iterations -- readability over single-pass
                      typeInfo.methods
                        .filter(
                          (m: { name?: string; scope?: string }) =>
                            m.name && m.scope !== "static"
                        )
                        .map((m: { name?: string }) => ({
                          slug: `${(e.slug ?? e.name).toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}-${(m.name ?? "unknown").toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-")}`,
                          name: m.name ?? "unknown",
                          title: m.name ?? "unknown",
                        }))
                    : undefined
                return {
                  slug: e.slug ?? e.name,
                  name: e.name,
                  title: e.name,
                  kind: typeInfo?.kind ? kindToLabel(typeInfo.kind) : null,
                  methods,
                }
              })
            )
            return { name: ref.name, exports }
          } catch {
            return null
          }
        })
      )
    )
    return results.filter((r): r is ApiReferenceResult => r !== null)
  }
)
