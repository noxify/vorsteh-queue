// import type { FileSystemEntry } from "renoun/file-system"
import type { z } from "zod"
import { cache } from "react"
import { Collection, Directory, isDirectory, isFile } from "renoun/file-system"

import type { frontmatterSchema } from "./validations"
import { removeFromArray } from "./lib/utils"
import { docSchema, featuresSchema } from "./validations"

export type Frontmatter = z.infer<typeof frontmatterSchema>

export const features = new Directory({
  path: "content/features",
  filter: "*.mdx",
  schema: {
    mdx: {
      frontmatter: featuresSchema,
    },
  },
  loader: {
    mdx: (path) => import(`../content/features/${path}.mdx`),
  },
})

export const DocumentationDirectory = new Directory({
  path: `content/docs`,
  basePathname: "docs",
  repository: {
    repository: "vorsteh-queue",
    branch: "main",
    host: "github",
    owner: "noxify",
    baseUrl: "https://github.com",
  },
  // hide hidden files ( starts with `_` ) and all asset directories ( `_assets` )
  filter: (entry) => !entry.baseName.startsWith("_") && !entry.absolutePath.includes("_assets"),
  schema: {
    mdx: docSchema,
  },
  loader: {
    mdx: (path) => import(`../content/docs/${path}.mdx`),
  },
})

export const ExampleDirectory = new Directory({
  path: `../../examples`,
  basePathname: "docs/examples",
  repository: {
    repository: "vorsteh-queue",
    branch: "main",
    host: "github",
    owner: "noxify",
    baseUrl: "https://github.com",
  },
  filter: (entry) => {
    return (
      !entry.baseName.startsWith("_") &&
      !entry.baseName.startsWith(".") &&
      !entry.absolutePath.includes("_assets") &&
      // do not fetch all files in the example
      // `depth == 0` - include the root `examples/readme.mdx`
      // `depth == 1` - include only the `examples/<example>/readme.mdx
      (entry.depth == 1 || entry.depth == 0) &&
      (isDirectory(entry) || isFile(entry, "mdx"))
    )
  },
  schema: {
    mdx: docSchema,
  },
  loader: {
    mdx: (path) => import(`../../../examples/${path}.mdx`),
  },
})

export const AllDocumentation = new Collection({
  entries: [DocumentationDirectory, ExampleDirectory],
})

export type EntryType = Awaited<ReturnType<typeof AllDocumentation.getEntry>>
export type DirectoryType = Awaited<ReturnType<typeof AllDocumentation.getDirectory>>

/**
 * Helper function to get the title for an element in the sidebar/navigation
 * @param entry {EntryType} the entry to get the title for
 * @param frontmatter {z.infer<typeof frontmatterSchema>} the frontmatter to get the title from
 * @param includeTitle? {boolean} whether to include the title in the returned string
 * @returns {string} the title to be displayed in the sidebar/navigation
 */
export function getTitle(
  entry: EntryType,
  frontmatter: z.infer<typeof frontmatterSchema>,
  includeTitle = false,
): string {
  return includeTitle
    ? (frontmatter.navTitle ?? frontmatter.title ?? entry.title)
    : (frontmatter.navTitle ?? entry.title)
}

/**
 * Helper function to get the sections for a given source entry
 * This function will try to get the sections based on the given path
 *
 * If there there are no entries/children for the current path, it will return an empty array
 *
 * @param source {EntryType} the source entry to get the sections for
 * @returns
 */
export async function getSections(source: EntryType) {
  if (source.depth > -1) {
    if (isDirectory(source)) {
      const parent = await (await getDirectory(source)).getEntries()
      return await Promise.all(parent.map(async (ele) => await getTransformedEntry(ele)))
    }

    if (isFile(source) && source.baseName === "index") {
      const parent = await (await getDirectory(source.getParent())).getEntries()
      return await Promise.all(parent.map(async (ele) => await getTransformedEntry(ele)))
    }
    return []
  } else {
    const parent = await (await getDirectory(source)).getEntries()
    return await Promise.all(parent.map(async (ele) => await getTransformedEntry(ele)))
  }
}

/**
 * Helper function to get the breadcrumb items for a given slug
 *
 * @param slug {string[]} the slug to get the breadcrumb items for
 */
export const getBreadcrumbItems = async (slug: string[] = []) => {
  // we do not want to have "index" as breadcrumb element
  const cleanedSlug = removeFromArray(slug, ["index"])

  const combinations = cleanedSlug.map((_, index) => cleanedSlug.slice(0, index + 1))

  const items = []

  for (const currentPageSegement of combinations) {
    const entry = (await transformedEntries()).find(
      (ele) => ele.raw_pathname === `/${currentPageSegement.join("/")}`,
    )

    if (!entry) {
      continue
    }

    items.push({
      title: entry.title,
      path: entry.segments,
    })
  }

  return items
}

/**
 * Checks if an entry is hidden (starts with an underscore)
 *
 * @param entry {EntryType} the entry to check for visibility
 */
export function isHidden(entry: EntryType) {
  return entry.baseName.startsWith("_")
}

/**
 * Gets a file from the documentation collection based on the source entry
 * Attempts to find the file in the following order:
 * 1. Direct segment file
 * 2. Index file in the segment directory
 * 3. Readme file in the segment directory
 *
 * Handles special case for examples by excluding "docs" segment from the path
 *
 * @param source {EntryType} The source entry to get the file for
 * @returns The found file or null if no file exists
 */

export async function getFile(source: EntryType) {
  const segments = source.getPathnameSegments({
    includeBasePathname: true,
    includeDirectoryNamedSegment: true,
  })

  const excludeSegments = segments[1] === "examples" ? ["docs"] : []

  const [segmentFile, indexFile, readmeFile] = await Promise.all([
    AllDocumentation.getFile(removeFromArray(segments, excludeSegments), "mdx").catch(() => null),
    AllDocumentation.getFile(removeFromArray([...segments, "index"], excludeSegments), "mdx").catch(
      () => null,
    ),
    AllDocumentation.getFile(
      removeFromArray([...segments, "readme"], excludeSegments),
      "mdx",
    ).catch(() => null),
  ])

  return segmentFile ?? indexFile ?? readmeFile ?? null
}

/**
 * Gets a directory from the documentation collection based on the source entry
 * Handles special case for examples by excluding "docs" segment from the path
 *
 * @param source {EntryType} The source entry to get the directory for
 * @returns The directory corresponding to the source entry
 */
export async function getDirectory(source: EntryType) {
  const segments = source.getPathnameSegments({
    includeBasePathname: true,
    includeDirectoryNamedSegment: true,
  })

  const excludeSegments = segments[1] === "examples" ? ["docs"] : []

  const currentDirectory = await AllDocumentation.getDirectory(
    removeFromArray(segments, excludeSegments),
  )

  return currentDirectory
}

/**
 * Retrieves the frontmatter metadata from a documentation file
 * @param source {Awaited<ReturnType<typeof getFile>>} The file to get metadata from
 * @returns The frontmatter metadata if it exists
 */
export async function getMetadata(source: Awaited<ReturnType<typeof getFile>>) {
  return (await source?.getExportValue("frontmatter")) as Frontmatter | undefined
}

/**
 * Gets the previous and next entries relative to the current entry in the documentation
 * Returns a tuple containing [previousEntry, nextEntry] where either can be undefined
 * if at the start/end of the documentation
 *
 * @param source {Awaited<ReturnType<typeof getTransformedEntry>>} The current entry to get siblings for
 * @returns Tuple of previous and next entries
 */
export async function getSiblings(
  source: Awaited<ReturnType<typeof getTransformedEntry>>,
): Promise<
  [
    Awaited<ReturnType<typeof getTransformedEntry>> | undefined,
    Awaited<ReturnType<typeof getTransformedEntry>> | undefined,
  ]
> {
  const entries = await transformedEntries()

  const arrayUniqueByKey = [...new Map(entries.map((item) => [item.raw_pathname, item])).values()]

  const currentIndex = arrayUniqueByKey.findIndex((ele) => ele.raw_pathname === source.raw_pathname)

  const previousElement = currentIndex > 0 ? arrayUniqueByKey[currentIndex - 1] : undefined

  const nextElement =
    currentIndex < arrayUniqueByKey.length - 1 ? arrayUniqueByKey[currentIndex + 1] : undefined

  return [previousElement, nextElement]
}

/**
 * Transforms a FileSystemEntry into a standardized object containing key information
 *
 * @param source {EntryType} The file system entry to transform
 */
export async function getTransformedEntry(source: EntryType) {
  const file = await getFile(source)
  const metadata = file ? await getMetadata(file) : null

  return {
    raw_pathname: source.getPathname({ includeBasePathname: true }),
    pathname: source.getPathname({ includeBasePathname: false }),
    segments: source.getPathnameSegments({ includeBasePathname: true }),
    title: metadata ? getTitle(source, metadata, true) : source.title,
    path: source.absolutePath,
    entry: source,
    file,
    isDirectory: isDirectory(source),
  }
}

/**
 * Recursively builds a flat list of all entries in the documentation.
 * Traverses the entry tree and filters out hidden entries (those starting with underscore).
 *
 * @param entry - The root entry to start flattening from
 * @returns Promise resolving to a flat array of all visible entries in the tree
 */
export async function flattenEntries(entry: EntryType): Promise<EntryType[]> {
  if (isHidden(entry)) {
    return []
  }

  const entries: EntryType[] = [entry]

  if ("getEntries" in entry) {
    const children = await entry.getEntries()
    const childEntries = await Promise.all(children.map((child) => flattenEntries(child)))
    entries.push(...childEntries.flat())
  }

  return entries
}

/**
 * Caches and returns an array of transformed entries from the AllDocumentation collection
 * Recursively gets all entries including index and readme files and transforms them
 */
export const transformedEntries = cache(async () => {
  const collections = await AllDocumentation.getEntries({
    recursive: false,
    includeIndexAndReadmeFiles: true,
  })

  // Flatten all entries from all collections
  const allEntries: EntryType[] = []
  for (const collection of collections) {
    const flattened = await flattenEntries(collection)
    allEntries.push(...flattened)
  }

  // Transform to serializable format
  const entries = await Promise.all(allEntries.map((entry) => getTransformedEntry(entry)))

  return entries
})
