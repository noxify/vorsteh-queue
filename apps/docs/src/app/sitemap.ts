import type { MetadataRoute } from "next"

import { transformedEntries } from "~/collections"

export const dynamic = "force-static"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const links = await transformedEntries()

  return links.map((link) => {
    return {
      url: `https://vorsteh-queue.dev${link.raw_pathname}`,
      lastModified: new Date(),
    }
  })
}
