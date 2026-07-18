import type { Job, JobStatus } from "@vorsteh-queue/core"
import { Box, Text, useInput } from "ink"
import { useEffect, useState } from "react"

import { Badge } from "../components/ui/badge"
import { Pagination } from "../components/ui/pagination"
import { Spinner } from "../components/ui/spinner"
import { Table } from "../components/ui/table"
import { useDashboard } from "../context"

interface JobsViewProps {
  readonly isFocused: boolean
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

const TIME_RANGES = [
  { label: "all", ms: 0 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
] as const

const PAGE_SIZE = 15

/**
 * Paginated job list with status, name, and time-range filters.
 */
export function JobsView({ isFocused }: JobsViewProps) {
  const {
    transport,
    refreshInterval,
    selectJob,
    goBack,
    activeQueue,
    jobsFilterIndex,
    jobsPage,
    setJobsFilterIndex,
    setJobsPage,
  } = useDashboard()
  const [jobs, setJobs] = useState<readonly Job[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [nameFilter, setNameFilter] = useState("")
  const [nameInputActive, setNameInputActive] = useState(false)
  const [timeRangeIndex, setTimeRangeIndex] = useState(0)
  const [isLastPage, setIsLastPage] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [sortKey, setSortKey] = useState<string>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const activeFilter = STATUS_FILTERS[jobsFilterIndex] ?? "all"
  const activeTimeRange = TIME_RANGES[timeRangeIndex] ?? TIME_RANGES[0]

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      try {
        const [result, total] = await Promise.all([
          transport.getJobs({
            limit: PAGE_SIZE,
            name: nameFilter || undefined,
            offset: jobsPage * PAGE_SIZE,
            status: activeFilter === "all" ? undefined : activeFilter,
          }),
          transport.size(),
        ])
        if (mounted) {
          setJobs(result)
          setIsLastPage(result.length < PAGE_SIZE)
          setTotalCount(total)
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
  }, [
    transport,
    refreshInterval,
    jobsPage,
    activeFilter,
    activeQueue,
    nameFilter,
  ])

  const hasMorePages = !isLastPage

  // Apply client-side time filter
  const timeFiltered =
    activeTimeRange.ms === 0
      ? jobs
      : jobs.filter((job) => {
          const created =
            job.createdAt instanceof Date
              ? job.createdAt.getTime()
              : new Date(job.createdAt).getTime()
          return Date.now() - created <= activeTimeRange.ms
        })

  // Apply client-side sort
  const filteredJobs = [...timeFiltered].toSorted((a, b) => {
    const aVal = String(
      (a as unknown as Record<string, unknown>)[sortKey] ?? ""
    )
    const bVal = String(
      (b as unknown as Record<string, unknown>)[sortKey] ?? ""
    )
    const cmp = aVal.localeCompare(bVal)
    return sortDir === "asc" ? cmp : -cmp
  })

  // oxlint-disable-next-line complexity -- keyboard handler with multiple modes
  useInput((input, key) => {
    if (!isFocused) {
      return
    }

    // Name input mode — capture text
    if (nameInputActive) {
      if (key.escape) {
        setNameInputActive(false)
      } else if (key.return) {
        setNameInputActive(false)
        setJobsPage(0)
      } else if (key.backspace || key.delete) {
        setNameFilter((f) => f.slice(0, -1))
      } else if (!key.ctrl && !key.tab && input) {
        setNameFilter((f) => f + input)
      }
      return
    }

    // Normal mode
    if (input === "/") {
      setNameInputActive(true)
      return
    }

    if (key.rightArrow || input === "l") {
      setJobsFilterIndex((jobsFilterIndex + 1) % STATUS_FILTERS.length)
      setJobsPage(0)
    } else if (key.leftArrow || input === "h") {
      setJobsFilterIndex(
        (jobsFilterIndex - 1 + STATUS_FILTERS.length) % STATUS_FILTERS.length
      )
      setJobsPage(0)
    } else if (input === "t") {
      setTimeRangeIndex((i) => (i + 1) % TIME_RANGES.length)
    } else if (input === "s") {
      const sortColumns = ["name", "status", "priority", "attempts"]
      const currentIdx = sortColumns.indexOf(sortKey)
      const nextIdx = (currentIdx + 1) % sortColumns.length
      const nextKey = sortColumns[nextIdx]
      if (nextKey) {
        setSortKey(nextKey)
      }
    } else if (input === "S") {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else if (key.ctrl && input === "d" && hasMorePages) {
      setJobsPage(jobsPage + 1)
    } else if (key.ctrl && input === "u" && jobsPage > 0) {
      setJobsPage(jobsPage - 1)
    } else if (key.escape) {
      if (nameFilter) {
        setNameFilter("")
        setJobsPage(0)
      } else {
        goBack()
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

  if (loading) {
    return <Spinner label="Loading jobs..." />
  }

  const tableData = filteredJobs.map((job) => ({
    attempts: `${job.attempts}/${job.maxAttempts}`,
    id: job.id,
    name: job.name.slice(0, 20),
    priority: String(job.priority),
    processAt: relativeTime(job.processAt),
    status: job.status,
  }))

  return (
    <Box flexDirection="column">
      {/* Status filter bar */}
      <Box marginBottom={0}>
        <Text color="gray">Status: </Text>
        {STATUS_FILTERS.map((f, i) => (
          <Box key={f} marginRight={1}>
            {i === jobsFilterIndex ? (
              <Badge variant={getStatusVariant(f)} bordered={false} bold>
                {f}
              </Badge>
            ) : (
              <Text color="gray">{f}</Text>
            )}
          </Box>
        ))}
      </Box>

      {/* Time range + Name filter bar */}
      <Box marginBottom={1}>
        <Text color="gray">Time: </Text>
        {TIME_RANGES.map((tr, i) => (
          <Box key={tr.label} marginRight={1}>
            <Text
              color={i === timeRangeIndex ? "#f97316" : "gray"}
              bold={i === timeRangeIndex}
            >
              {i === timeRangeIndex ? `[${tr.label}]` : tr.label}
            </Text>
          </Box>
        ))}
        <Text color="gray"> │ </Text>
        {nameInputActive ? (
          <Box>
            <Text color="#f97316">/ </Text>
            <Text>{nameFilter}</Text>
            <Text color="#f97316">█</Text>
          </Box>
        ) : nameFilter ? (
          <Text color="#f97316">name: {nameFilter}</Text>
        ) : (
          <Text color="gray">/ search</Text>
        )}
        <Text color="gray"> │ </Text>
        <Text color="gray">sort: </Text>
        <Text color="#f97316" bold>
          {sortKey} {sortDir === "asc" ? "↑" : "↓"}
        </Text>
      </Box>

      {filteredJobs.length === 0 ? (
        <Text color="gray">No jobs found.</Text>
      ) : (
        <Table
          data={tableData}
          columns={[
            { header: "Name", key: "name", width: 20 },
            { header: "Status", key: "status", width: 12 },
            { align: "right", header: "Pri", key: "priority", width: 4 },
            { header: "Att", key: "attempts", width: 5 },
            { header: "Process At", key: "processAt", width: 10 },
          ]}
          selectable
          isActive={isFocused && !nameInputActive}
          onSelect={(row) => selectJob(row.id)}
          maxRows={PAGE_SIZE}
        />
      )}

      <Box marginTop={1} flexDirection="row" gap={2}>
        <Pagination
          total={Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}
          current={jobsPage + 1}
          onChange={(p) => setJobsPage(p - 1)}
        />
        <Text color="gray">
          {filteredJobs.length} of {totalCount} jobs
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

function relativeTime(date: Date): string {
  const ts = date instanceof Date ? date.getTime() : new Date(date).getTime()
  const diff = ts - Date.now()
  const abs = Math.abs(diff)

  if (abs < 60_000) {
    return diff > 0 ? "in <1m" : "<1m ago"
  }
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000)
    return diff > 0 ? `in ${m}m` : `${m}m ago`
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000)
    return diff > 0 ? `in ${h}h` : `${h}h ago`
  }
  const d = Math.round(abs / 86_400_000)
  return diff > 0 ? `in ${d}d` : `${d}d ago`
}
