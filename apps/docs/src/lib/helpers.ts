"use client"

import { resolveHref } from "next/dist/client/resolve-href"
import Router from "next/router"
import multimatch from "multimatch"

import type { TreeItem } from "./navigation"

export function isActive(currentPath: string | string[], checkPath: string | string[]) {
  return multimatch(currentPath, checkPath).length > 0
}

export const current = ({ pathname, item }: { pathname: string; item: TreeItem }) => {
  const active = isActive(
    pathname,
    [item.path, ...(item.children ?? []).map((ele) => ele.path)]
      .map((ele) => {
        const resolvedUrl = resolveHref(Router, ele)
        return [resolvedUrl, `${resolvedUrl}/**`]
      })
      .flat(),
  )

  return active
}
