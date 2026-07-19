import { Eye, Filter, Keyboard, Monitor } from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"

import { PageContainer } from "@/components/page-container"
import { buttonVariants } from "@/components/ui/button"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const bulletPoints = [
  { icon: Monitor, label: "Real-time queue stats with auto-refresh" },
  { icon: Filter, label: "Filter jobs by status, name, and time range" },
  { icon: Eye, label: "Inspect job details, payload, and errors" },
  { icon: Keyboard, label: "Full keyboard navigation with shortcuts" },
]

function TerminalMockup() {
  return (
    <div className="overflow-hidden rounded-xl border border-[#272b33] bg-[#0f1117] shadow-2xl">
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 border-b border-[#272b33] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="size-3 rounded-full bg-[#ff5f57]" />
          <div className="size-3 rounded-full bg-[#febc2e]" />
          <div className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 text-xs text-[#7c8da6]">
          vorsteh-queue dashboard
        </span>
      </div>

      {/* Terminal content */}
      <div className="p-5 font-mono text-xs leading-relaxed">
        {/* Sidebar + Content layout */}
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="flex flex-col gap-1 border-r border-[#272b33] pr-6">
            <span className="mb-1 text-[#7c8da6]">Queues</span>
            <span className="text-primary font-bold">▸ email</span>
            <span className="text-[#abb2bf]"> data-processing</span>
            <span className="text-[#abb2bf]"> notifications</span>
            <span className="mt-3 mb-1 text-[#7c8da6]">Views</span>
            <span className="text-primary font-bold">▸ Overview</span>
            <span className="text-[#abb2bf]"> Jobs</span>
            <span className="text-[#abb2bf]"> Dead Letter</span>
          </div>

          {/* Main content - Bar chart */}
          <div className="flex flex-col gap-2">
            <span className="mb-1 font-bold text-white">Job Status</span>
            <div className="flex items-center gap-2">
              <span className="w-20 text-right text-[#7c8da6]">Pending</span>
              <span className="text-yellow-400">████████░░░░░░░░</span>
              <span className="text-[#7c8da6]">247</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-right text-[#7c8da6]">Processing</span>
              <span className="text-cyan-400">███░░░░░░░░░░░░░</span>
              <span className="text-[#7c8da6]">12</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-right text-[#7c8da6]">Completed</span>
              <span className="text-green-400">████████████████</span>
              <span className="text-[#7c8da6]">1,893</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-right text-[#7c8da6]">Failed</span>
              <span className="text-red-400">██░░░░░░░░░░░░░░</span>
              <span className="text-[#7c8da6]">8</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-right text-[#7c8da6]">Dead</span>
              <span className="text-purple-400">█░░░░░░░░░░░░░░░</span>
              <span className="text-[#7c8da6]">3</span>
            </div>
            <div className="mt-2 text-[#7c8da6]">
              Total: 2,163 {"  "}[j/↵] View jobs
            </div>
          </div>
        </div>

        {/* Footer - key hints */}
        <div className="mt-4 border-t border-[#272b33] pt-3 text-[#7c8da6]">
          <span className="text-[#abb2bf]">Tab</span> switch pane {"  "}
          <span className="text-[#abb2bf]">o</span> overview {"  "}
          <span className="text-[#abb2bf]">j</span> jobs {"  "}
          <span className="text-[#abb2bf]">d</span> dead letter {"  "}
          <span className="text-[#abb2bf]">?</span> help {"  "}
          <span className="text-[#abb2bf]">q</span> quit
        </div>
      </div>
    </div>
  )
}

export function DashboardSection() {
  return (
    <section className="bg-muted/30 py-24">
      <PageContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column - terminal mockup */}
          <div className="relative">
            <TerminalMockup />
          </div>

          {/* Right column - text */}
          <div className="flex flex-col gap-6">
            <span className="text-primary text-sm font-semibold tracking-wider uppercase">
              Terminal Dashboard
            </span>
            <h2
              className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              Monitor your queues without leaving the terminal.
            </h2>
            <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">
              A full-featured interactive TUI dashboard for real-time queue
              monitoring. Navigate between queues, inspect jobs, retry failures,
              and manage dead letters — all from your terminal.
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
                href="/docs/cli"
                prefetch={false}
                className={buttonVariants({ size: "lg" })}
              >
                CLI Documentation
              </Link>
              <Link
                href="/docs/examples/advanced/tui-dashboard"
                prefetch={false}
                className={buttonVariants({ size: "lg", variant: "ghost" })}
              >
                Try the Example
              </Link>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
