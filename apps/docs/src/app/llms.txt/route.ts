import { availableCollections } from "@/collections"
import {
  getCollectionDocPaths,
  textResponse,
  toRawHref,
} from "@/shared/doc-paths"

export const dynamic = "force-static"

export async function GET(): Promise<Response> {
  const collectionLines = await Promise.all(
    availableCollections.map(async (collection) => {
      const collectionPaths = await getCollectionDocPaths(collection)
      const collectionRoot = collectionPaths.find(
        (slug) => slug.length === 1
      ) ?? [collection]

      return [
        "",
        `## ${collection}`,
        `- llm.txt: /llms/${collection}.txt`,
        `- Docs root: /docs/${collection}`,
        `- Raw root: ${toRawHref(collectionRoot)}`,
      ].join("\n")
    })
  )

  const body = [
    "# llms index",
    "",
    "This file lists the available documentation collections for LLM ingestion.",
    "Prefer the collection-specific llms files for complete link trees.",

    ...collectionLines,
  ].join("\n")

  return textResponse(body)
}
