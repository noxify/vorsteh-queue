import type { LlmsTreeItem } from "@/collection-helpers"
import { getCollectionLlmsTree } from "@/collection-helpers"
import { availableCollections } from "@/collections"
import { textResponse } from "@/shared/doc-paths"

export const dynamic = "force-static"

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
        ? `${indent}- [${item.title}](${baseUrl}${item.docsHref})${descriptionPart}${rawPart}`
        : `${indent}- [${item.title}](${baseUrl}${item.docsHref})${descriptionPart}${rawPart}`

      const children =
        item.children.length > 0
          ? `\n${renderLlmsTree(item.children, baseUrl, depth + 1)}`
          : ""

      return line + children
    })
    .join("\n")
}

export async function GET(): Promise<Response> {
  // oxlint-disable-next-line no-restricted-properties
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ""

  const sections = await Promise.all(
    availableCollections.map(async (collection) => {
      const tree = await getCollectionLlmsTree(collection)

      if (tree.length === 0) {
        return ["", `## ${collection}\n\n_No entries found._`]
      }

      return ["", `## ${collection}`, "", renderLlmsTree(tree, baseUrl)].join(
        "\n"
      )
    })
  )

  const body = [
    "# llms full",
    "",
    "Complete LLM-oriented tree for all documentation collections.",
    ...sections,
  ].join("\n")

  return textResponse(body)
}
