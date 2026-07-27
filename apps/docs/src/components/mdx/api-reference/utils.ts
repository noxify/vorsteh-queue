import path from "node:path"

import type { ComponentPropsWithoutRef } from "react"

export type AnchorProps = ComponentPropsWithoutRef<"a">

/** Resolve a package-relative file path to an absolute path on disk. */
export function resolvePackagePath(file: string): string {
  return path.resolve(process.cwd(), "../../packages", `${file}.ts`)
}

export function kindToLabel(kind: string): string {
  return kind.replaceAll(
    /(?<lower>[a-z])(?<upper>[A-Z])/gu,
    "$<lower> $<upper>"
  )
}

/**
 * Extracts @see tags into link objects.
 * Supports:
 * - `@see https://example.com`
 * - `@see {@link https://example.com | Label}`
 */
export function extractSeeLinks(
  tags?: { name: string; text?: string }[]
): { url: string; label: string }[] | undefined {
  if (!tags) {
    return undefined
  }

  const links = tags
    .filter((t) => t.name === "see" && t.text)
    .map((t) => {
      // oxlint-disable-next-line typescript/no-non-null-assertion
      const text = t.text!.trim()

      // {@link url | label} format
      const linkMatch =
        /^\{@link\s+(?<url>https?:\/\/\S+?)(?:\s*\|\s*(?<label>[^}]+))?\}$/u.exec(
          text
        )

      if (linkMatch?.groups?.url) {
        return {
          url: linkMatch.groups.url,
          label: linkMatch.groups.label?.trim() || linkMatch.groups.url,
        }
      }

      // Plain URL
      const urlMatch = /^(?<url>https?:\/\/\S+)$/u.exec(text)

      if (urlMatch?.groups?.url) {
        const urlObj = new URL(urlMatch.groups.url)
        const lastSegment = urlObj.pathname.split("/").findLast(Boolean)
        return {
          url: urlMatch.groups.url,
          label: lastSegment?.replace(/\.html$/u, "") || urlMatch.groups.url,
        }
      }

      return null
    })
    .filter((l): l is { url: string; label: string } => l !== null)

  return links.length > 0 ? links : undefined
}
