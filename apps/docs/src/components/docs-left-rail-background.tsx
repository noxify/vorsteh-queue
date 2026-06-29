"use client"

import { useSidebar } from "@/components/ui/sidebar"

export function DocsLeftRailBackground() {
  const { open, isMobile } = useSidebar()

  const width = !isMobile && open ? "var(--docs-left-rail-width)" : "0px"

  return (
    <div
      aria-hidden="true"
      className="bg-sidebar pointer-events-none fixed top-0 bottom-0 left-0 hidden xl:block"
      style={{
        width,
      }}
    />
  )
}
