import { availableCollections } from "@/collections"
import { normalizeInternalHref } from "@/lib/normalize-internal-href"

export const dynamic = "force-static"
export const runtime = "nodejs"

const SITE_URL = "https://vorsteh-queue.dev"

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

export async function GET(): Promise<Response> {
  const urls = [
    SITE_URL,
    `${SITE_URL}${normalizeInternalHref("/docs")}`,
    ...availableCollections.map(
      (collection) => `${SITE_URL}/sitemap/${collection}.xml`
    ),
  ]

  return new Response(renderUrlSet(urls), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}
