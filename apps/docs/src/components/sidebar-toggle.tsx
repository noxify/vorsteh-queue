"use client"

import { SearchIcon } from "lucide-react"

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"

import { Button } from "./ui/button"
import { Separator } from "./ui/separator"

export function SidebarToggle() {
  const { state, isMobile } = useSidebar()

  if (isMobile || state !== "collapsed") {
    return null
  }

  return (
    <div className="fixed top-10 left-0 z-10 hidden md:block">
      <div className="bg-background border-muted flex gap-x-1 rounded-r-lg border border-l-0 p-1 shadow">
        <SidebarTrigger size={"icon"} className={"cursor-pointer"} />
        <Separator orientation="vertical" />
        <Button variant={"ghost"} size={"icon"} className={"cursor-pointer"}>
          <SearchIcon />
        </Button>
      </div>
    </div>
  )
}
