import { staticRoutes } from "@/collection-helpers"

// Hilfsfunktion: entfernt alle Vorkommen von items aus arr
function removeFromArray<T>(arr: readonly T[], items: readonly T[]): T[] {
  return arr.filter((el) => !items.includes(el))
}

export function toRawHref(slug: readonly string[]): string {
  if (slug.length === 0) {
    return "/raw"
  }

  const lastSegment = slug.at(-1)

  if (!lastSegment) {
    return "/raw"
  }

  const rawSlug = [...slug.slice(0, -1), `${lastSegment}.md`]

  return `/raw/${rawSlug.join("/")}`
}

export function textResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}

export function normalizeRawSlugParts(
  slug: readonly string[] | undefined
): readonly string[] {
  if (!slug || slug.length === 0) {
    return slug ?? []
  }

  const lastSegment = slug.at(-1)

  if (!lastSegment?.endsWith(".md")) {
    return slug
  }

  const normalizedLastSegment = lastSegment.slice(0, -3)

  if (normalizedLastSegment.length === 0) {
    return slug
  }

  return [...slug.slice(0, -1), normalizedLastSegment]
}

export function addMdSuffixToLastSegment(
  slug: readonly string[]
): readonly string[] {
  if (slug.length === 0) {
    return slug
  }

  const lastSegment = slug.at(-1)

  if (!lastSegment || lastSegment.endsWith(".md")) {
    return slug
  }

  return [...slug.slice(0, -1), `${lastSegment}.md`]
}

function dedupeSlugPaths(
  paths: readonly { slug: readonly string[] }[]
): { slug: string[] }[] {
  const seen = new Set<string>()
  const deduped: { slug: string[] }[] = []

  for (const path of paths) {
    const key = path.slug.join("/")

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push({ slug: [...path.slug] })
  }

  return deduped
}

export async function getNormalizedDocPaths(): Promise<string[][]> {
  const entries = await staticRoutes()

  const normalized = entries
    .map((entryPathSegments) => removeFromArray(entryPathSegments, ["docs"]))
    .map((slug) => {
      const lastSegment = slug.at(-1)
      if (lastSegment === "index" || lastSegment === "readme") {
        return slug.slice(0, -1)
      }
      return slug
    })
    .filter((slug) => slug.length > 0)

  const seen = new Set<string>()
  const deduped: string[][] = []

  for (const slug of normalized) {
    const key = slug.join("/")
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(slug)
  }

  return deduped
}

export async function getCollectionDocPaths(
  collection: string
): Promise<string[][]> {
  const paths = await getNormalizedDocPaths()

  return paths.filter((slug) => slug[0] === collection)
}

export async function getRawRouteParams(): Promise<{ slug: string[] }[]> {
  const basePaths = await getNormalizedDocPaths()

  const mdOnlyPaths = basePaths.map((slug) => ({
    slug: [...addMdSuffixToLastSegment(slug)],
  }))

  return dedupeSlugPaths(mdOnlyPaths)
}
