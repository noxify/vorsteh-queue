import multimatch from "multimatch"

import { DEFAULT_DOCS_PATH } from "./docs-default"
import type { TreeItem } from "./navigation"
import { resolveHref } from "./resolve-href"

export function isActive(
  currentPath: string | string[],
  checkPath: string | string[]
) {
  return multimatch(currentPath, checkPath).length > 0
}

export const current = ({
  pathname,
  item,
}: {
  pathname: string
  item: TreeItem
}) => {
  const pathnameCandidates = getPathnameCandidates(pathname)
  const paths = [item.url, ...collectChildUrls(item)]
  const active = isActive(
    pathnameCandidates,
    paths.flatMap((entryPath) => {
      const resolvedUrl = resolveHref(entryPath)
      return [resolvedUrl, `${resolvedUrl}/**`]
    })
  )

  return active
}

function getPathnameCandidates(pathname: string): string[] {
  const resolvedPathname = resolveHref(pathname)
  const candidates = [resolvedPathname]

  if (resolvedPathname === "/docs" || resolvedPathname === "/docs/") {
    candidates.push(DEFAULT_DOCS_PATH)
    candidates.push(`${DEFAULT_DOCS_PATH}/`)
  }

  return candidates
}

function collectChildUrls(item: TreeItem): string[] {
  const urls: string[] = []

  for (const child of item.children ?? []) {
    urls.push(child.url)
    urls.push(...collectChildUrls(child))
  }

  return urls
}
