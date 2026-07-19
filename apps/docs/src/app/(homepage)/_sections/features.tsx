import {
  Activity,
  ArrowUpDown,
  Calendar,
  Clock,
  Code2,
  Gauge,
  GitBranch,
  Inbox,
  Pause,
  RefreshCw,
  Repeat,
  TrendingUp,
} from "lucide-react"
import { Space_Grotesk } from "next/font/google"

import { PageContainer } from "@/components/page-container"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const features = [
  {
    description: "Fire and forget or run exactly once jobs.",
    icon: Clock,
    title: "One-time Jobs",
  },
  {
    description: "Schedule jobs to run in the future with precision.",
    icon: Pause,
    title: "Delayed Jobs",
  },
  {
    description: "Cron-based scheduling with timezone support.",
    icon: Calendar,
    title: "Scheduled Jobs",
  },
  {
    description: "Run jobs on fixed intervals with ease.",
    icon: Repeat,
    title: "Recurring Jobs",
  },
  {
    description: "Prioritize what matters most. High to low.",
    icon: ArrowUpDown,
    title: "Job Priorities",
  },
  {
    description: "Automatic retries with customizable backoff strategies.",
    icon: RefreshCw,
    title: "Retries & Backoff",
  },
  {
    description: "Failed jobs don't disappear. Inspect and retry them safely.",
    icon: Inbox,
    title: "Dead Letter Queue",
  },
  {
    description: "Parent-child job hierarchies with dependency tracking.",
    icon: GitBranch,
    title: "Flow Pipelines",
  },
  {
    description: "Real-time percentage updates during job execution.",
    icon: TrendingUp,
    title: "Progress Tracking",
  },
  {
    description: "Opt-in metrics and distributed tracing via OpenTelemetry.",
    icon: Activity,
    title: "OpenTelemetry Built-in",
  },
  {
    description: "Pause, resume, and manage workers with graceful shutdown.",
    icon: Gauge,
    title: "Worker Controls",
  },
  {
    description: "Full TypeScript support with excellent DX.",
    icon: Code2,
    title: "TypeScript First",
  },
]

export function FeaturesSection() {
  return (
    <section className="bg-muted/30 py-24">
      <PageContainer>
        <div className="mb-12 text-center">
          <span className="text-primary mb-3 block text-sm font-semibold tracking-wider uppercase">
            Powerful Features
          </span>
          <h2
            className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: spaceGrotesk.style.fontFamily }}
          >
            Everything you need to build robust background systems.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-2">
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg">
                <feature.icon className="text-primary size-5" />
              </div>
              <h3 className="text-foreground text-sm font-semibold">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
