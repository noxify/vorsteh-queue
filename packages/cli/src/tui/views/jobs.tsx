import type { Job, JobStatus } from "@vorsteh-queue/core"
import { Box, Text, useInput } from "ink"
import { useEffect, useState } from "react"

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
 */
export function JobsView({ refreshInterval, onSelectJob }: JobsViewProps) {
  const { transport } = useTransportContext()
  const [jobs, setJobs] = useState<readonly Job[]>([])
  const [cursor, setCursor] = useState(0)
  const [page, setPage] = useState(0)
  const [filterIndex, setFilterIndex] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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
  }, [transport, refreshInterval, page, activeFilter])

  useInput((input, key) => {
    if (key.downArrow || input === "j") {
      setCursor((prev) => Math.min(prev + 1, jobs.length - 1))
    } else if (key.upArrow || input === "k") {
      setCursor((prev) => Math.max(prev - 1, 0))
    } else if (key.rightArrow || input === "l") {
      setFilterIndex((prev) => (prev + 1) % STATUS_FILTERS.length)
      setCursor(0)
      setPage(0)
    } else if (key.leftArrow || input === "h") {
      setFilterIndex(
        (prev) => (prev - 1 + STATUS_FILTERS.length) % STATUS_FILTERS.length
      )
      setCursor(0)
      setPage(0)
    } else if (input === "n") {
      setPage((prev) => prev + 1)
      setCursor(0)
    } else if (input === "p" && page > 0) {
      setPage((prev) => prev - 1)
      setCursor(0)
    } else if (key.return) {
      const selected = jobs[cursor]
      if (selected) {
        onSelectJob(selected.id)
      }
    }
  })

  if (errorMsg) {
    return (
      <Box>
        <Text color="red">Error: {errorMsg}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="gray">Filter: </Text>
        {STATUS_FILTERS.map((f, i) => (
          <Text
            key={f}
            color={i === filterIndex ? "cyan" : "gray"}
            bold={i === filterIndex}
          >
            {i === filterIndex ? `[${f}]` : ` ${f} `}
          </Text>
        ))}
        <Text color="gray"> (←/→)</Text>
      </Box>

      {jobs.length === 0 ? (
        <Text color="gray">No jobs found.</Text>
      ) : (
        <Box flexDirection="column">
          <Box>
            <Box width={4}>
              <Text color="gray">#</Text>
            </Box>
            <Box width={26}>
              <Text color="gray">Name</Text>
            </Box>
            <Box width={14}>
              <Text color="gray">Status</Text>
            </Box>
            <Box width={6}>
              <Text color="gray">Pri</Text>
            </Box>
            <Box width={8}>
              <Text color="gray">Attempt</Text>
            </Box>
          </Box>
          {jobs.map((job, i) => (
            <JobRow key={job.id} job={job} selected={i === cursor} index={i} />
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">
          Page {page + 1} | [n] Next [p] Prev | {jobs.length} jobs shown
        </Text>
      </Box>
    </Box>
  )
}

function JobRow({
  job,
  selected,
  index,
}: {
  readonly job: Job
  readonly selected: boolean
  readonly index: number
}) {
  const statusColor = getStatusColor(job.status)
  return (
    <Box>
      <Box width={4}>
        <Text color={selected ? "cyan" : "gray"}>
          {selected ? "›" : " "} {index + 1}
        </Text>
      </Box>
      <Box width={26}>
        <Text color={selected ? "white" : undefined} bold={selected}>
          {job.name.slice(0, 24)}
        </Text>
      </Box>
      <Box width={14}>
        <Text color={statusColor}>{job.status}</Text>
      </Box>
      <Box width={6}>
        <Text>{job.priority}</Text>
      </Box>
      <Box width={8}>
        <Text>
          {job.attempts}/{job.maxAttempts}
        </Text>
      </Box>
    </Box>
  )
}

function getStatusColor(status: JobStatus): string {
  switch (status) {
    case "pending": {
      return "yellow"
    }
    case "processing": {
      return "cyan"
    }
    case "completed": {
      return "green"
    }
    case "failed": {
      return "red"
    }
    case "dead": {
      return "magenta"
    }
    case "delayed": {
      return "blue"
    }
    case "cancelled": {
      return "gray"
    }
    default: {
      return "white"
    }
  }
}
