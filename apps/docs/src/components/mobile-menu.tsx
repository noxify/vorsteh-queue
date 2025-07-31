"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import type { TreeItem } from "~/lib/navigation"
import { Button } from "./ui/button"

export default function MobileMenu({ items }: { items: TreeItem[] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="ml-1 md:hidden"
      >
        {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        <span className="sr-only">Toggle menu</span>
      </Button>
      {mobileMenuOpen && (
        <div className="absolute inset-x-0 top-16 border-b bg-background/95 backdrop-blur-lg md:hidden">
          <div className="container flex flex-col gap-4 py-4">
            {items.map((ele, idx) => (
              <Link
                key={idx}
                href={ele.path}
                className="text-dark-200 transition-colors hover:text-orange-primary dark:text-dark-900 dark:hover:text-orange-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                {ele.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
