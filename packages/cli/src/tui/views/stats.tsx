import type { QueueStats } from "@vorsteh-queue/core"
import { Box, Text } from "ink"
import { useEffect, useState } from "react"

import { useTransportContext } from "../context"

interface StatsViewProps {
  readonly refreshInterval: number
}

/**
 * Queue statistics overview with auto-refresh.
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
    return (
      <Box>
        <Text color="gray">Loading...</Text>
      </Box>
    )
  }

  const total =
    stats.pending +
    stats.delayed +
    stats.processing +
    stats.completed +
    stats.failed +
    stats.cancelled +
    stats.dead

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" gap={0}>
        <StatRow label="Pending" value={stats.pending} color="yellow" />
        <StatRow label="Delayed" value={stats.delayed} color="blue" />
        <StatRow label="Processing" value={stats.processing} color="cyan" />
        <StatRow label="Completed" value={stats.completed} color="green" />
        <StatRow label="Failed" value={stats.failed} color="red" />
        <StatRow label="Cancelled" value={stats.cancelled} color="gray" />
        <StatRow label="Dead" value={stats.dead} color="magenta" />
      </Box>
      <Box marginTop={1}>
        <Text color="gray">Total: {total}</Text>
      </Box>
    </Box>
  )
}

function StatRow({
  label,
  value,
  color,
}: {
  readonly label: string
  readonly value: number
  readonly color: string
}) {
  const bar = value > 0 ? "█".repeat(Math.min(value, 40)) : ""
  return (
    <Box>
      <Box width={12}>
        <Text>{label}</Text>
      </Box>
      <Box width={6}>
        <Text bold>{value}</Text>
      </Box>
      <Text color={color}>{bar}</Text>
    </Box>
  )
}
