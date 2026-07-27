import { notFound } from "next/navigation"

import type { LlmsTreeItem } from "@/collection-helpers"
import { getCollectionLlmsTree } from "@/collection-helpers"
import type { AvailableCollection } from "@/collections"
import { availableCollections } from "@/collections"
import { textResponse } from "@/shared/doc-paths"

export const dynamic = "force-static"

function normalizeCollectionName(
  collectionName: string
): AvailableCollection | undefined {
  if (!collectionName.endsWith(".txt")) {
    return undefined
  }

  const collection = collectionName.slice(0, -4)

  if (collection.length === 0) {
    return undefined
  }

  return availableCollections.includes(collection as AvailableCollection)
    ? (collection as AvailableCollection)
    : undefined
}

function renderLlmsTree(
  items: LlmsTreeItem[],
  baseUrl: string,
  depth = 0
): string {
  const indent = "  ".repeat(depth)

  return items
    .map((item) => {
      const descriptionPart = item.description ? `: ${item.description}` : ""
      const rawPart = ` (raw: ${baseUrl}${item.rawHref})`

      const line = item.isDirectory
        ? `${indent}- ${item.title}${descriptionPart}${rawPart}`
        : `${indent}- [${item.title}](${baseUrl}${item.docsHref})${descriptionPart}${rawPart}`

      const children =
        item.children.length > 0
          ? `\n${renderLlmsTree(item.children, baseUrl, depth + 1)}`
          : ""

      return line + children
    })
    .join("\n")
}

export async function generateStaticParams(): Promise<
  { collectionName: string }[]
> {
  return availableCollections.map((collection) => ({
    collectionName: `${collection}.txt`,
  }))
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/llms/[collectionName]">
): Promise<Response> {
  const { collectionName } = await ctx.params
  const collection = normalizeCollectionName(collectionName)

  if (!collection) {
    notFound()
  }

  const tree = await getCollectionLlmsTree(collection)

  if (tree.length === 0) {
    notFound()
  }

  // oxlint-disable-next-line no-restricted-properties
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""

  const body = [`# ${collection}`, "", renderLlmsTree(tree, baseUrl)].join("\n")

  return textResponse(body)
}
