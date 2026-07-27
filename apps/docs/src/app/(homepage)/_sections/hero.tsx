import {
  ArrowRight,
  CheckCircle2,
  Database,
  Layers,
  Shield,
} from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"

import { PageContainer } from "@/components/page-container"
import { buttonVariants } from "@/components/ui/button"
import { useMDXComponents } from "@/mdx-components"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const codeSnippet = `import { Queue, MemoryQueueAdapter } from "@vorsteh-queue/core"

const queue = new Queue(new MemoryQueueAdapter(), { name: "my-queue" })

// Register a handler
queue.register("send-email", async (job) => {
  await sendEmail(job.payload.to, job.payload.template)
  return { sent: true }
})

// Add a job
await queue.add("send-email", {
  to: "user@example.com",
  template: "welcome",
})

// Start processing
queue.start()`

const features = [
  { icon: Database, label: "PostgreSQL 12+" },
  { icon: Layers, label: "ORM-Agnostic" },
  { icon: Shield, label: "Production-Ready" },
  { icon: CheckCircle2, label: "Open Source" },
]

export function HeroSection() {
  return (
    <section className="relative -mt-14 overflow-hidden pt-28 pb-16">
      {/* Dot pattern background — fades to transparent at bottom */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, transparent 100%)",
        }}
      />
      {/* Orange gradient glow - top center */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[800px] -translate-x-1/2 rounded-full opacity-[0.09] blur-[80px]"
        style={{ background: "linear-gradient(90deg, #f97316, #ea580c)" }}
      />

      <PageContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column - text content */}
          <div className="flex flex-col gap-6">
            <h1
              className="text-foreground text-4xl leading-tight font-bold tracking-tight sm:text-4xl lg:leading-[1.1] xl:text-5xl"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              Reliable Job Queue for Modern Applications
            </h1>

            <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">
              A type-safe PostgreSQL job queue for Node.js with durable
              execution, flow orchestration, and first-class ORM adapters.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/docs"
                prefetch={false}
                className={buttonVariants({ size: "lg" })}
              >
                Get Started
                <ArrowRight className="ml-1.5 size-4" />
              </Link>
              <a
                href="https://github.com/noxify/vorsteh-queue"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg", variant: "ghost" })}
              >
                View on GitHub
              </a>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              {features.map((feature) => (
                <span
                  key={feature.label}
                  className="text-muted-foreground inline-flex items-center gap-1.5"
                >
                  <feature.icon className="text-primary size-4" />
                  {feature.label}
                </span>
              ))}
            </div>
          </div>

          {/* Right column - code snippet */}
          <div className="relative min-w-0 overflow-hidden">
            {useMDXComponents().CodeBlock({
              children: codeSnippet,
              language: "ts",
              shouldAnalyze: false,
            })}
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
