import type { Metadata } from "next"
import type React from "react"

import "./globals.css"

import { ThemeProvider } from "~/components/theme-provider"

export const metadata: Metadata = {
  title: "Vorsteh Queue - Reliable Job Queue for Modern Applications",
  description:
    "A powerful, ORM-agnostic queue engine that works with any database. Handle background jobs, scheduled tasks, and recurring processes with ease.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
