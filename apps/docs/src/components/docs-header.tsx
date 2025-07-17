"use client"

import Image from "next/image"

import { SearchDialog } from "~/components/search-dialog"
import { ThemeToggle } from "~/components/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { SidebarTrigger } from "~/components/ui/sidebar"

export function DocsHeader() {
  return (
    <header className="border-cream-200 dark:border-dark-100 bg-cream-50/80 dark:bg-dark-200/80 sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 hidden h-4 md:block" />
      <div className="mr-auto flex items-center space-x-3">
        <Image
          src="/vorsteh-queue-logo.svg"
          alt="Vorsteh Queue Logo"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <span className="text-dark-200 dark:text-dark-900 text-lg font-bold">Vorsteh Queue</span>
      </div>

      {/* Breadcrumbs (example, can be dynamic based on route) */}
      <Breadcrumb className="hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/docs">Docs</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/docs/getting-started">Getting Started</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Installation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center space-x-2">
        <SearchDialog />
        <ThemeToggle />
        <Button className="bg-orange-darker hover:bg-orange-accessible hidden text-white sm:inline-flex">
          Get Started
        </Button>
      </div>
    </header>
  )
}
