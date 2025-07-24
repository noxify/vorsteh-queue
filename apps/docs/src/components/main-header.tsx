import Image from "next/image"
import Link from "next/link"
import { GitProviderLink, GitProviderLogo } from "renoun/components"

import { Search } from "~/components/search"
import { Button } from "~/components/shadcn/button"
import { ThemeToggle } from "~/components/theme-toggle"

const links = [
  {
    name: "Docs",
    target: "/docs",
  },
  {
    name: "Examples",
    target: "/docs/examples",
  },
  {
    name: "Adapters",
    target: "/docs/adapters",
  },
]

export default function MainHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-cream-200 bg-cream-50/80 backdrop-blur-sm dark:border-dark-100 dark:bg-dark-200/80">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link href={"/"} className="flex items-center space-x-3">
          <Image
            src="/vorsteh-queue-logo.svg"
            alt="Vorsteh Queue Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="text-xl font-bold text-dark-200 dark:text-dark-900">Vorsteh Queue</span>
        </Link>

        <nav className="items-center md:flex">
          <div className="hidden items-center space-x-6 md:flex">
            {links.map((ele, eleIdx) => (
              <Link
                key={eleIdx}
                href={ele.target}
                className="text-dark-200 transition-colors hover:text-orange-primary dark:text-dark-900"
              >
                {ele.name}
              </Link>
            ))}
          </div>
          <div className="ml-6 flex items-center space-x-1">
            <Search />
            <ThemeToggle />
            <Button variant={"ghost"} size={"icon"}>
              <GitProviderLink>
                <GitProviderLogo width="1.2rem" height="1.2rem" />
              </GitProviderLink>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  )
}
