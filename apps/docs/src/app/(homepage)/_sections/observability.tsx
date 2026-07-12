import { Activity, BarChart3, GitBranch, Terminal } from "lucide-react"
import { Space_Grotesk } from "next/font/google"
import Link from "next/link"

import { PageContainer } from "@/components/page-container"
import { buttonVariants } from "@/components/ui/button"

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] })

const bulletPoints = [
  { icon: Activity, label: "Automatic metrics: counters, histograms, gauges" },
  { icon: GitBranch, label: "Distributed tracing with job-level spans" },
  {
    icon: BarChart3,
    label: "Export to Prometheus, Grafana, Datadog, and more",
  },
  { icon: Terminal, label: "CLI for queue stats, job inspection, and retry" },
]

export function ObservabilitySection() {
  return (
    <section className="bg-muted/30 py-24">
      <PageContainer>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column - text */}
          <div className="flex flex-col gap-6">
            <span className="text-primary text-sm font-semibold tracking-wider uppercase">
              OpenTelemetry Native
            </span>
            <h2
              className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl"
              style={{ fontFamily: spaceGrotesk.style.fontFamily }}
            >
              Observability without the glue code.
            </h2>
            <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">
              vorsteh-queue instruments itself automatically via OpenTelemetry.
              Metrics, traces, and job spans flow into your existing
              observability stack with zero configuration.
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
                href="/docs/vorsteh-queue/core/observability"
                prefetch={false}
                className={buttonVariants({ size: "lg" })}
              >
                Observability Guide
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

          {/* Right column - code example */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-[#272b33] bg-[#0f1117] shadow-2xl">
              {/* Tab bar */}
              <div className="flex items-center gap-0 border-b border-[#272b33]">
                <div className="border-b-primary border-b-2 px-4 py-2.5 text-xs font-medium text-white">
                  instrumentation.ts
                </div>
                <div className="ml-auto flex items-center gap-3 px-4">
                  <span className="text-muted-foreground text-xs">
                    Zero overhead without SDK
                  </span>
                </div>
              </div>

              {/* Code content */}
              <div className="p-5">
                <pre className="text-xs leading-relaxed">
                  <code>
                    <span className="text-[#7c8da6]">
                      {"// Your existing OTel setup — that's it\n"}
                    </span>
                    <span className="text-[#c678dd]">import</span>
                    <span className="text-[#abb2bf]">{" { NodeSDK } "}</span>
                    <span className="text-[#c678dd]">from</span>
                    <span className="text-[#98c379]">
                      {" '@opentelemetry/sdk-node'\n"}
                    </span>
                    <span className="text-[#c678dd]">import</span>
                    <span className="text-[#abb2bf]">
                      {" { OTLPMetricExporter } "}
                    </span>
                    <span className="text-[#c678dd]">from</span>
                    <span className="text-[#98c379]">
                      {" '@opentelemetry/exporter-metrics-otlp-http'\n\n"}
                    </span>
                    <span className="text-[#c678dd]">const</span>
                    <span className="text-[#abb2bf]"> sdk = </span>
                    <span className="text-[#c678dd]">new</span>
                    <span className="text-[#61afef]"> NodeSDK</span>
                    <span className="text-[#abb2bf]">{"({\n"}</span>
                    <span className="text-[#abb2bf]">{"  metricReader: "}</span>
                    <span className="text-[#c678dd]">new</span>
                    <span className="text-[#61afef]">
                      {" OTLPMetricExporter"}
                    </span>
                    <span className="text-[#abb2bf]">{"(),\n"})</span>
                    {"\n\n"}
                    <span className="text-[#abb2bf]">sdk.</span>
                    <span className="text-[#61afef]">start</span>
                    <span className="text-[#abb2bf]">()</span>
                    {"\n\n"}
                    <span className="text-[#7c8da6]">
                      {"// vorsteh-queue automatically emits:\n"}
                    </span>
                    <span className="text-[#7c8da6]">
                      {"// ✓ vorsteh_queue.jobs.processed\n"}
                    </span>
                    <span className="text-[#7c8da6]">
                      {"// ✓ vorsteh_queue.jobs.failed\n"}
                    </span>
                    <span className="text-[#7c8da6]">
                      {"// ✓ vorsteh_queue.jobs.duration\n"}
                    </span>
                    <span className="text-[#7c8da6]">
                      {"// ✓ vorsteh_queue.jobs.wait_time\n"}
                    </span>
                    <span className="text-[#7c8da6]">
                      {"// ✓ Distributed traces per job\n"}
                    </span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
