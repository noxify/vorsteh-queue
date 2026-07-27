import { notFound } from "next/navigation"

import type { AvailableCollection } from "@/collections"
import { availableCollections } from "@/collections"
import { normalizeInternalHref } from "@/lib/normalize-internal-href"
import { getCollectionDocPaths } from "@/shared/doc-paths"

export const dynamic = "force-static"
export const runtime = "nodejs"

const SITE_URL = "https://vorsteh-queue.dev"

function normalizeCollectionName(
  collectionName: string
): AvailableCollection | undefined {
  if (!collectionName.endsWith(".xml")) {
    return undefined
  }

  const collection = collectionName.slice(0, -4)

  if (!collection) {
    return undefined
  }

  return availableCollections.includes(collection as AvailableCollection)
    ? (collection as AvailableCollection)
    : undefined
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function renderUrlSet(urls: string[]): string {
  const urlEntries = urls
    .map((url) => `<url><loc>${escapeXml(url)}</loc></url>`)
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlEntries}</urlset>`
}

export async function generateStaticParams(): Promise<
  { collectionName: string }[]
> {
  return availableCollections.map((collection) => ({
    collectionName: `${collection}.xml`,
  }))
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ collectionName: string }> }
): Promise<Response> {
  const { collectionName } = await ctx.params
  const collection = normalizeCollectionName(collectionName)

  if (!collection) {
    notFound()
  }

  const collectionPaths = await getCollectionDocPaths(collection)
  const urls = collectionPaths.map(
    (segments) =>
      `${SITE_URL}${normalizeInternalHref(`/docs/${segments.join("/")}`)}`
  )

  return new Response(renderUrlSet(urls), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}
