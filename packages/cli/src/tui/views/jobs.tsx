import type { Job, JobStatus } from "@vorsteh-queue/core"
import { Box, Text, useInput } from "ink"
import { useEffect, useState } from "react"

import { Badge } from "../components/ui/badge"
import { Spinner } from "../components/ui/spinner"
import { Table } from "../components/ui/table"
import { useTransportContext } from "../context"

interface JobsViewProps {
  readonly refreshInterval: number
  readonly onSelectJob: (jobId: string) => void
}

const STATUS_FILTERS: readonly (JobStatus | "all")[] = [
  "all",
  "pending",
  "processing",
  "completed",
  "failed",
  "dead",
  "delayed",
  "cancelled",
]

const PAGE_SIZE = 15

/**
 * Paginated job list with status filter and keyboard navigation.
 * Uses termcn Table component for rendering.
 */
export function JobsView({ refreshInterval, onSelectJob }: JobsViewProps) {
  const { transport } = useTransportContext()
  const [jobs, setJobs] = useState<readonly Job[]>([])
  const [page, setPage] = useState(0)
  const [filterIndex, setFilterIndex] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const activeFilter = STATUS_FILTERS[filterIndex] ?? "all"

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      try {
        const result = await transport.getJobs({
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          status: activeFilter === "all" ? undefined : activeFilter,
        })
        if (mounted) {
          setJobs(result)
          setErrorMsg(null)
          setLoading(false)
        }
      } catch (error) {
        if (mounted) {
          setErrorMsg(error instanceof Error ? error.message : "Unknown error")
          setLoading(false)
        }
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), refreshInterval)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [transport, refreshInterval, page, activeFilter])

  useInput((input, key) => {
    if (key.rightArrow || input === "l") {
      setFilterIndex((prev) => (prev + 1) % STATUS_FILTERS.length)
      setPage(0)
    } else if (key.leftArrow || input === "h") {
      setFilterIndex(
        (prev) => (prev - 1 + STATUS_FILTERS.length) % STATUS_FILTERS.length
      )
      setPage(0)
    } else if (key.ctrl && input === "d") {
      setPage((prev) => prev + 1)
    } else if (key.ctrl && input === "u" && page > 0) {
      setPage((prev) => prev - 1)
    }
  })

  if (errorMsg) {
    return (
      <Box>
        <Text color="red">Error: {errorMsg}</Text>
      </Box>
    )
  }

  if (loading) {
    return <Spinner label="Loading jobs..." />
  }

  const tableData = jobs.map((job) => ({
    attempts: `${job.attempts}/${job.maxAttempts}`,
    id: job.id,
    name: job.name.slice(0, 24),
    priority: String(job.priority),
    status: job.status,
  }))

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="gray">Filter: </Text>
        {STATUS_FILTERS.map((f, i) => (
          <Box key={f} marginRight={1}>
            {i === filterIndex ? (
              <Badge variant={getStatusVariant(f)} bordered={false} bold>
                {f}
              </Badge>
            ) : (
              <Text color="gray">{f}</Text>
            )}
          </Box>
        ))}
        <Text color="gray">(←/→)</Text>
      </Box>

      {jobs.length === 0 ? (
        <Text color="gray">No jobs found.</Text>
      ) : (
        <Table
          data={tableData}
          columns={[
            { header: "Name", key: "name", width: 24 },
            { header: "Status", key: "status", width: 12 },
            { align: "right", header: "Pri", key: "priority", width: 5 },
            { header: "Attempts", key: "attempts", width: 8 },
          ]}
          selectable
          onSelect={(row) => onSelectJob(row.id)}
          maxRows={PAGE_SIZE}
        />
      )}

      <Box marginTop={1}>
        <Text color="gray">
          Page {page + 1} | [C-d] Next [C-u] Prev | {jobs.length} jobs shown
        </Text>
      </Box>
    </Box>
  )
}

function getStatusVariant(
  status: JobStatus | "all"
): "default" | "success" | "warning" | "error" | "info" | "secondary" {
  switch (status) {
    case "completed": {
      return "success"
    }
    case "failed":
    case "dead": {
      return "error"
    }
    case "pending":
    case "delayed": {
      return "warning"
    }
    case "processing": {
      return "info"
    }
    case "cancelled": {
      return "secondary"
    }
    default: {
      return "default"
    }
  }
}
