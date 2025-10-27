import type { Metadata } from "next"
import type React from "react"
import { RootProvider as RenounProvider } from "renoun"

import "./globals.css"

import { ThemeProvider } from "~/components/theme-provider"

export const metadata: Metadata = {
  title: "Vorsteh Queue - Reliable Job Queue for Modern Applications",
  description:
    "A powerful, ORM-agnostic queue engine for PostgreSQL 12. Handle background jobs, scheduled tasks, and recurring processes with ease.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <RenounProvider
      defaultPackageManager="pnpm"
      git={{
        source: "https://github.com/noxify/vorsteh-queue",
        branch: "main",
        host: "github",
        owner: "noxify",
        repository: "vorsteh-queue",
        baseUrl: "https://github.com",
      }}
      siteUrl="https://vorsteh-queue.dev"
      languages={[
        "css",
        "javascript",
        "jsx",
        "typescript",
        "tsx",
        "markdown",
        "mdx",
        "shellscript",
        "json",
        "html",
        "python",
        "graphql",
        "yaml",
        "sql",
        "xml",
        "docker",
        "prisma",
      ]}
      theme={{
        dark: "one-dark-pro",
        light: "one-dark-pro",
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute={["class", "data-theme"]}
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </body>
      </html>
    </RenounProvider>
  )
}
