import { Space_Grotesk } from "next/font/google"
import Link from "next/link"

import { VorstehQueueLogo } from "@/components/logo"
import { PageContainer } from "@/components/page-container"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

export function SiteFooter() {
  return (
    <footer className="border-t">
      <PageContainer>
        <div className="flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <VorstehQueueLogo className="h-8" />
              <span
                className="text-lg font-bold"
                style={{ fontFamily: spaceGrotesk.style.fontFamily }}
              >
                Vorsteh Queue
              </span>
            </div>
            <p className="text-muted-foreground max-w-md text-sm">
              Reliable job processing for PostgreSQL. Simple, powerful, and
              built for production.
            </p>
          </div>

          <div className="flex gap-12 text-sm">
            <nav className="flex flex-row gap-3">
              <Link
                href="/"
                prefetch={false}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <Link
                href="/docs"
                prefetch={false}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Docs
              </Link>
              <Link
                href="/docs/examples"
                prefetch={false}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Examples
              </Link>
            </nav>
          </div>
        </div>

        <div className="border-t py-6 text-center text-sm">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} Vorsteh Queue. Released under the MIT
            License.
          </p>
          <p className="text-muted-foreground mt-1">
            Powered by{" "}
            <a
              href="https://renoun.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground font-semibold transition-colors"
            >
              Renoun
            </a>
          </p>
        </div>
      </PageContainer>
    </footer>
  )
}
