import { GitFork, Heart, Scale, Star, Users } from "lucide-react"
import { Space_Grotesk } from "next/font/google"

import { PageContainer } from "@/components/page-container"
import { buttonVariants } from "@/components/ui/button"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const badges = [
  { icon: Scale, label: "MIT License" },
  { icon: Users, label: "Community Driven" },
  { icon: GitFork, label: "No vendor lock-in" },
]

export function OpenSourceSection() {
  return (
    <section className="py-24">
      <PageContainer className="text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex size-14 items-center justify-center rounded-full">
          <Heart className="text-primary size-7 fill-current" />
        </div>

        <h2
          className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ fontFamily: spaceGrotesk.style.fontFamily }}
        >
          Free &amp; Open Source
        </h2>

        <p className="text-muted-foreground mx-auto mt-4 max-w-4xl text-lg">
          Vorsteh Queue is completely free and open source. Built by developers,
          for developers.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className="text-muted-foreground inline-flex items-center gap-2"
            >
              <badge.icon className="size-4" />
              {badge.label}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://github.com/vorsteh/vorsteh-queue"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg" })}
          >
            <Star className="size-4" />
            Star on GitHub
          </a>
          <a
            href="https://github.com/vorsteh/vorsteh-queue/blob/main/CONTRIBUTING.md"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ size: "lg", variant: "ghost" })}
          >
            <GitFork className="size-4" />
            Contribute
          </a>
        </div>
      </PageContainer>
    </section>
  )
}
