import { Blocks, Clock, Gauge, Layers, Shield, Zap } from "lucide-react"
import { Space_Grotesk } from "next/font/google"

import { PageContainer } from "@/components/page-container"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const reasons = [
  {
    icon: Zap,
    title: "Blazing Fast",
    description:
      "Optimized for high throughput with minimal overhead. Built on PostgreSQL, tuned for performance.",
  },
  {
    icon: Shield,
    title: "Reliable by Design",
    description:
      "Backed by PostgreSQL's ACID guarantees and advanced locking. Your jobs are safe and consistent.",
  },
  {
    icon: Layers,
    title: "ORM Agnostic",
    description:
      "Works with any ORM or query builder. Use it your way, without being locked in.",
  },
  {
    icon: Clock,
    title: "Flexible Scheduling",
    description:
      "Cron jobs, delayed jobs, and recurring tasks. Powerful scheduling without added complexity.",
  },
  {
    icon: Gauge,
    title: "Production Ready",
    description:
      "Monitoring, retries, backoff strategies, dead letter queues, and more. Everything you need in production.",
  },
  {
    icon: Blocks,
    title: "Open & Extensible",
    description:
      "100% open source. Clean architecture, extensible APIs, and a welcoming community.",
  },
]

export function WhyChooseSection() {
  return (
    <section className="py-24">
      <PageContainer>
        <div className="mb-12 text-center">
          <span className="text-primary mb-3 block text-sm font-semibold tracking-wider uppercase">
            Why Choose Vorsteh Queue?
          </span>
          <h2
            className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: spaceGrotesk.style.fontFamily }}
          >
            Built for developers who value reliability,
            <br />
            <span className="italic">simplicity</span>, and control.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((reason) => (
            <Card
              key={reason.title}
              className="border-border/60 bg-card/50 backdrop-blur-sm"
            >
              <CardHeader>
                <div className="bg-primary/10 mb-2 flex size-10 items-center justify-center rounded-lg">
                  <reason.icon className="text-primary size-5" />
                </div>
                <CardTitle className="text-base">{reason.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {reason.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
