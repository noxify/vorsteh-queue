import type { Metadata } from "next"
import type React from "react"
import { PackageInstallScript, ThemeStyles } from "renoun/components"

import "./globals.css"

import { ThemeProvider } from "~/components/theme-provider"

export const metadata: Metadata = {
  title: "Vorsteh Queue - Reliable Job Queue for Modern Applications",
  description:
    "A powerful, ORM-agnostic queue engine for PostgreSQL 12. Handle background jobs, scheduled tasks, and recurring processes with ease.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeStyles />
        <PackageInstallScript />
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
  )
}
