import type { QueueStats } from "@vorsteh-queue/core"
import { Box, Text } from "ink"
import { useEffect, useState } from "react"

import { BarChart } from "../components/ui/bar-chart"
import { Spinner } from "../components/ui/spinner"
import { useTransportContext } from "../context"

interface StatsViewProps {
  readonly refreshInterval: number
}

/**
 * Queue statistics overview with auto-refresh using termcn BarChart.
 */
export function StatsView({ refreshInterval }: StatsViewProps) {
  const { transport } = useTransportContext()
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      try {
        const result = await transport.getStats()
        if (mounted) {
          setStats(result)
          setErrorMsg(null)
        }
      } catch (error) {
        if (mounted) {
          setErrorMsg(error instanceof Error ? error.message : "Unknown error")
        }
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), refreshInterval)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [transport, refreshInterval])

  if (errorMsg) {
    return (
      <Box>
        <Text color="red">Error: {errorMsg}</Text>
      </Box>
    )
  }

  if (!stats) {
    return <Spinner label="Loading stats..." />
  }

  const total =
    stats.pending +
    stats.delayed +
    stats.processing +
    stats.completed +
    stats.failed +
    stats.cancelled +
    stats.dead

  const chartData = [
    { color: "yellow", label: "Pending", value: stats.pending },
    { color: "blue", label: "Delayed", value: stats.delayed },
    { color: "cyan", label: "Processing", value: stats.processing },
    { color: "green", label: "Completed", value: stats.completed },
    { color: "red", label: "Failed", value: stats.failed },
    { color: "gray", label: "Cancelled", value: stats.cancelled },
    { color: "magenta", label: "Dead", value: stats.dead },
  ]

  return (
    <Box flexDirection="column">
      <BarChart data={chartData} width={50} showValues title="Job Status" />
      <Box marginTop={1}>
        <Text color="gray">Total: {total}</Text>
      </Box>
    </Box>
  )
}
