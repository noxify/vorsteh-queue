import { Activity, CheckCircle2, Eye, Inbox } from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"

import { PageContainer } from "@/components/page-container"
import { buttonVariants } from "@/components/ui/button"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const bulletPoints = [
  { icon: Activity, label: "Real-time job and worker metrics" },
  { icon: Eye, label: "Queue health and throughput" },
  { icon: CheckCircle2, label: "Job inspection and retry" },
  { icon: Inbox, label: "Dead letter queue management" },
]

export function ObservabilitySection() {
  return (
    <section className="bg-muted/30 py-24">
      <PageContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column - text */}
          <div className="flex flex-col gap-6">
            <span className="text-primary text-sm font-semibold tracking-wider uppercase">
              Observe. Operate. Optimize.
            </span>
            <h2
              className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              Built-in observability and control.
            </h2>
            <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">
              Monitor queues, inspect jobs, and manage workers with built-in
              tools and a clean dashboard.
            </p>

            <ul className="flex flex-col gap-3">
              {bulletPoints.map((point) => (
                <li
                  key={point.label}
                  className="text-foreground flex items-center gap-3 text-sm"
                >
                  <point.icon className="text-primary size-4 shrink-0" />
                  {point.label}
                </li>
              ))}
            </ul>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/docs/vorsteh-queue/packages/server"
                prefetch={false}
                className={buttonVariants({ size: "lg" })}
              >
                Explore the Dashboard
              </Link>
              <Link
                href="/docs"
                prefetch={false}
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                View Docs
              </Link>
            </div>
          </div>

          {/* Right column - dashboard mockup */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-[#272b33] bg-[#0f1117] shadow-2xl">
              {/* Tab bar */}
              <div className="flex items-center gap-0 border-b border-[#272b33]">
                <div className="border-b-primary border-b-2 px-4 py-2.5 text-xs font-medium text-white">
                  Overview
                </div>
                <div className="text-muted-foreground px-4 py-2.5 text-xs">
                  Overview
                </div>
                <div className="ml-auto flex items-center gap-3 px-4">
                  <span className="text-muted-foreground text-xs">
                    Auto-refresh
                  </span>
                  <span className="text-muted-foreground text-xs">
                    Last 5 minutes
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-0 border-b border-[#272b33]">
                <DashboardStat
                  label="Total Jobs"
                  value="24,532"
                  change="+12.3%"
                  positive
                />
                <DashboardStat
                  label="Processed"
                  value="22,410"
                  change="+11.5%"
                  positive
                />
                <DashboardStat
                  label="Failed"
                  value="312"
                  change="-1.7%"
                  positive
                />
                <DashboardStat label="Active Workers" value="8" />
              </div>

              {/* Content area */}
              <div className="grid grid-cols-5 gap-0">
                {/* Chart placeholder */}
                <div className="col-span-3 border-r border-[#272b33] p-4">
                  <p className="text-muted-foreground mb-3 text-xs font-medium">
                    Jobs Processed
                  </p>
                  <div className="flex h-20 items-end gap-1">
                    {[35, 45, 55, 40, 60, 70, 50, 65, 80, 75, 55, 60].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="bg-primary/60 flex-1 rounded-sm"
                          style={{ height: `${h}%` }}
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Queues table */}
                <div className="col-span-2 p-4">
                  <p className="text-muted-foreground mb-3 text-xs font-medium">
                    Queues
                  </p>
                  <div className="flex flex-col gap-2 text-xs">
                    <QueueRow
                      name="default"
                      pending="1,543"
                      active="3"
                      rate="107/min"
                    />
                    <QueueRow
                      name="emails"
                      pending="832"
                      active="2"
                      rate="45/min"
                    />
                    <QueueRow
                      name="reports"
                      pending="392"
                      active="1"
                      rate="15/min"
                    />
                    <QueueRow
                      name="cleanup"
                      pending="18"
                      active="1"
                      rate="10/min"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  )
}

function DashboardStat({
  label,
  value,
  change,
  positive,
}: {
  label: string
  value: string
  change?: string
  positive?: boolean
}) {
  return (
    <div className="border-r border-[#272b33] p-4 last:border-r-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
      {change && (
        <p
          className={`mt-0.5 text-xs ${positive ? "text-emerald-400" : "text-red-400"}`}
        >
          {change}
        </p>
      )}
    </div>
  )
}

function QueueRow({
  name,
  pending,
  active,
  rate,
}: {
  name: string
  pending: string
  active: string
  rate: string
}) {
  return (
    <div className="text-muted-foreground flex items-center justify-between">
      <span className="text-white">{name}</span>
      <span>{pending}</span>
      <span>{active}</span>
      <span>{rate}</span>
    </div>
  )
}
