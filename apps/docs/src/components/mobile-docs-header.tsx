"use client"

import { Search } from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"

import { cn } from "@/lib/utils"

import { VorstehQueueLogo } from "./logo"
import { SearchCommand } from "./search-command"
import { Button } from "./ui/button"
import { SidebarTrigger } from "./ui/sidebar"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

export function MobileDocsHeader() {
  return (
    <header
      className={cn(
        "bg-background fixed inset-x-0 top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b px-4 transition-transform duration-300 ease-in-out md:hidden"
      )}
    >
      <div className="flex w-full justify-between">
        <div>
          <Link href="/" prefetch={false} className="flex items-center gap-2.5">
            <VorstehQueueLogo className="size-6" />
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              LakeQL
            </span>
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <SearchCommand>
            <Button variant="ghost" size="icon" className="size-8">
              <Search className="size-4" />
            </Button>
          </SearchCommand>
          <SidebarTrigger className="cursor-pointer" />
        </div>
      </div>
    </header>
  )
}
