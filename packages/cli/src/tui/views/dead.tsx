import type { Job } from "@vorsteh-queue/core"
import { Box, Text, useInput } from "ink"
import { useEffect, useState } from "react"

import { Spinner } from "../components/ui/spinner"
import { Table } from "../components/ui/table"
import { useDashboard } from "../context"

interface DeadViewProps {
  readonly isFocused: boolean
}

/**
 * Dead-letter queue view — shows jobs that exceeded max retry attempts.
 */
export function DeadView({ isFocused }: DeadViewProps) {
  const { transport, refreshInterval, selectJob, goBack, activeQueue } =
    useDashboard()
  const [jobs, setJobs] = useState<readonly Job[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const refresh = async () => {
      try {
        const result = await transport.getDeadJobs({ limit: 20, offset: 0 })
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
  }, [transport, refreshInterval, activeQueue])

  useEffect(() => {
    setLoading(true)
  }, [activeQueue])

  useInput((input, key) => {
    if (!isFocused) {
      return
    }
    if (key.escape) {
      goBack()
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
    return <Spinner label="Loading dead-letter jobs..." />
  }

  if (jobs.length === 0) {
    return (
      <Box>
        <Text color="green">No dead-letter jobs. All clear.</Text>
      </Box>
    )
  }

  const tableData = jobs.map((job) => ({
    created:
      job.createdAt instanceof Date
        ? job.createdAt.toLocaleDateString()
        : String(job.createdAt),
    id: job.id,
    name: job.name.slice(0, 24),
    status: job.status,
  }))

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="magenta">
          Dead-Letter Queue
        </Text>
        <Text color="gray"> ({jobs.length} jobs)</Text>
      </Box>

      <Table
        data={tableData}
        columns={[
          { header: "Name", key: "name", width: 24 },
          { header: "Status", key: "status", width: 10 },
          { header: "Created", key: "created", width: 12 },
        ]}
        selectable
        sortable
        isActive={isFocused}
        onSelect={(row) => selectJob(row.id)}
        maxRows={20}
      />
    </Box>
  )
}
