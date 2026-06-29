"use client"

import { SiGithub as Github } from "@icons-pack/react-simple-icons"
import { Menu, Search } from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"
import { useState } from "react"

import { VorstehQueueLogo } from "@/components/logo"
import { Button, buttonVariants } from "@/components/ui/button"
import { useScrollVisibility } from "@/hooks/use-scroll-visibility"
import { cn } from "@/lib/utils"

import { SearchCommand } from "./search-command"
import ThemeToggle from "./theme-toggle"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/docs", label: "Docs" },
  { href: "/docs/examples", label: "Examples" },
]

export function SiteHeader({
  fullWidth = false,
  bordered = false,
}: {
  fullWidth?: boolean
  bordered?: boolean
}) {
  const { hasScrolled: isScrolled } = useScrollVisibility({
    hideAfterScrollY: 0,
  })
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-200",
        isScrolled
          ? "border-border/60 bg-background/80 border-b backdrop-blur-sm"
          : "border-transparent bg-transparent",
        bordered
          ? "border-border/60 bg-background/80 border-b backdrop-blur-sm"
          : ""
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center px-6",
          fullWidth ? "w-full" : "mx-auto max-w-6xl"
        )}
      >
        {/* Left: logo + nav */}
        <div className="flex items-center gap-6">
          <Link href="/" prefetch={false} className="flex items-center gap-2.5">
            <VorstehQueueLogo className="h-8" />
            <span
              className="text-sm font-semibold"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              Vorsteh Queue
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: search + github + theme + mobile menu */}
        <div className="ml-auto flex items-center gap-1">
          <SearchCommand>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground size-8"
            >
              <Search className="size-4" />
            </Button>
          </SearchCommand>

          <a
            href="https://github.com/noxify/vorsteh-queue"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className={cn(
              buttonVariants({ size: "icon", variant: "ghost" }),
              "text-muted-foreground size-8"
            )}
          >
            <Github className="size-4" />
          </a>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground size-8 md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <nav className="border-border/60 border-t px-6 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                onClick={() => setMobileMenuOpen(false)}
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
