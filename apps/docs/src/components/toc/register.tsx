"use client"

import { useLayoutEffect } from "react"

/**
 * A component that registers heading ids with the `TableOfContentsScript`.
 * @internal
 */
export function Register({ ids }: { ids: string[] }) {
  useLayoutEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    window.__TableOfContents__?.register(ids)
  }, [ids])

  return null
}
