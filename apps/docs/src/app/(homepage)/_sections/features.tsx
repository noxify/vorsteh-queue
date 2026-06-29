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
    icon: Clock,
    title: "One-time Jobs",
    description: "Fire and forget or run exactly once jobs.",
  },
  {
    icon: Pause,
    title: "Delayed Jobs",
    description: "Schedule jobs to run in the future with precision.",
  },
  {
    icon: Calendar,
    title: "Scheduled Jobs",
    description: "Cron-based scheduling with timezone support.",
  },
  {
    icon: Repeat,
    title: "Recurring Jobs",
    description: "Run jobs on fixed intervals with ease.",
  },
  {
    icon: ArrowUpDown,
    title: "Job Priorities",
    description: "Prioritize what matters most. High to low.",
  },
  {
    icon: RefreshCw,
    title: "Retries & Backoff",
    description: "Automatic retries with customizable backoff strategies.",
  },
  {
    icon: Inbox,
    title: "Dead Letter Queue",
    description: "Failed jobs don't disappear. Inspect and retry them safely.",
  },
  {
    icon: GitBranch,
    title: "Flow Pipelines",
    description: "Parent-child job hierarchies with dependency tracking.",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Real-time percentage updates during job execution.",
  },
  {
    icon: Activity,
    title: "Metrics & Monitoring",
    description: "Built-in metrics and health checks for visibility.",
  },
  {
    icon: Gauge,
    title: "Worker Controls",
    description: "Pause, resume, and manage workers with graceful shutdown.",
  },
  {
    icon: Code2,
    title: "TypeScript First",
    description: "Full TypeScript support with excellent DX.",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24">
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
