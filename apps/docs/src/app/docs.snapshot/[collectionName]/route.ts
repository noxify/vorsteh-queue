import { notFound } from "next/navigation"

import type { AvailableCollection } from "@/collections"
import { availableCollections } from "@/collections"
import { buildDocsSnapshotJsonl } from "@/lib/docs-snapshot"

export const dynamic = "force-static"
export const runtime = "nodejs"

function normalizeCollectionName(
  collectionName: string
): AvailableCollection | undefined {
  if (!collectionName.endsWith(".jsonl")) {
    return undefined
  }

  const collection = collectionName.slice(0, -6)

  if (!collection) {
    return undefined
  }

  return availableCollections.includes(collection as AvailableCollection)
    ? (collection as AvailableCollection)
    : undefined
}

export async function generateStaticParams(): Promise<
  { collectionName: string }[]
> {
  return availableCollections.map((collection) => ({
    collectionName: `${collection}.jsonl`,
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

  const jsonl = await buildDocsSnapshotJsonl({ collection })

  return new Response(jsonl, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  })
}
