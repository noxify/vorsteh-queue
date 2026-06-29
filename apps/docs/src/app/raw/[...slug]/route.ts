import { notFound } from "next/navigation"
import type { NextRequest } from "next/server"

import { AllDocumentation } from "@/collections"
import {
  getRawRouteParams,
  normalizeRawSlugParts,
  textResponse,
} from "@/shared/doc-paths"

export const dynamic = "force-static"

export async function generateStaticParams() {
  return getRawRouteParams()
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/raw/[...slug]">
) {
  const { slug } = await ctx.params
  const normalizedSlug = [...normalizeRawSlugParts(slug)]

  let file = await AllDocumentation.getFile(normalizedSlug, "mdx").catch(
    () => null
  )

  if (!file) {
    file = await AllDocumentation.getFile(
      [...normalizedSlug, "index"],
      "mdx"
    ).catch(() => null)
  }

  if (!file) {
    file = await AllDocumentation.getFile(
      [...normalizedSlug, "readme"],
      "mdx"
    ).catch(() => null)
  }

  if (!file) {
    notFound()
  }

  const md = await file.getText()
  return textResponse(md)
}
