import "./globals.css"
import type { Metadata } from "next"
import { RootProvider } from "renoun"

import Analytics from "@/components/analytics"
import { SearchCommandProvider } from "@/components/search-command"
import { TailwindIndicator } from "@/components/tailwind-indicator"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const SITE_URL = "https://vorsteh-queue.dev"

function toJsonLd(value: unknown) {
  return JSON.stringify(value).replaceAll("</", "<\\/")
}

export const metadata: Metadata = {
  alternates: {
    types: {
      "application/x-ndjson": "/docs.snapshot.jsonl",
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vorsteh Queue",
  },
  description:
    "A type-safe PostgreSQL job queue for Node.js with durable execution, flow orchestration, and first-class ORM adapters.",
  icons: {
    apple: [
      { sizes: "180x180", type: "image/png", url: "/apple-touch-icon.png" },
    ],
    icon: [{ type: "image/svg+xml", url: "/icon.svg" }],
    shortcut: "/favicon.ico",
  },
  title: {
    default: "Vorsteh Queue",
    template: "%s | Vorsteh Queue",
  },
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  inLanguage: "en",
  name: "Vorsteh Queue",
  potentialAction: {
    "@type": "SearchAction",
    query: "required name=search_term_string",
    target: `${SITE_URL}/docs?search={search_term_string}`,
  },
  url: SITE_URL,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <RootProvider
      theme={{
        dark: [
          "github-dark",
          {
            colors: {
              "activityBar.background": "#211d1a",
              "editor.background": "#211d1a",
              "panel.border": "#211d1a",
            },
          },
        ],
        light: [
          "min-light",

          {
            colors: {
              "activityBar.background": "#faf9f7",
              "editor.background": "#faf9f7",
              "panel.border": "#faf9f7",
            },
          },
        ],
      }}
      languages={[
        "ts",
        "tsx",
        "mdx",
        "bash",
        "sql",
        "json",
        "dockerfile",
        "prisma",
        "graphql",
      ]}
      siteUrl={SITE_URL}
    >
      <html lang="en" suppressHydrationWarning className={cn("antialiased")}>
        <body>
          <script
            type="application/ld+json"
            // oxlint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd) }}
          />
          <Analytics />
          <ThemeProvider
            attribute={["class", "data-theme"]}
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              <SearchCommandProvider>{children}</SearchCommandProvider>
            </TooltipProvider>
            <TailwindIndicator />
          </ThemeProvider>
        </body>
      </html>
    </RootProvider>
  )
}
