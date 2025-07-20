import Image from "next/image"
import Link from "next/link"

import { ThemeToggle } from "~/components/theme-toggle"
import { Button } from "~/components/ui/button"

export default function MainHeader() {
  return (
    <header className="border-cream-200 dark:border-dark-100 bg-cream-50/80 dark:bg-dark-200/80 sticky top-0 z-50 border-b backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center space-x-3">
          <Image
            src="/vorsteh-queue-logo.svg"
            alt="Vorsteh Queue Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <span className="text-dark-200 dark:text-dark-900 text-xl font-bold">Vorsteh Queue</span>
        </div>
        <nav className="hidden items-center space-x-6 md:flex">
          <Link
            href="#features"
            className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
          >
            Features
          </Link>
          <Link
            href="#why"
            className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
          >
            Why Choose Us
          </Link>
          <Link
            href="#about" // New link for About section
            className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
          >
            About
          </Link>
          <Link
            href="#opensource"
            className="text-dark-200 dark:text-dark-900 hover:text-orange-primary transition-colors"
          >
            Open Source
          </Link>
          <ThemeToggle />
          <Button className="bg-orange-darker hover:bg-orange-accessible text-white">
            Get Started
          </Button>
        </nav>
      </div>
    </header>
  )
}
