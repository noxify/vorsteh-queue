import type { Job } from "@vorsteh-queue/core"
import { Box, Text, useInput } from "ink"
import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router"

import { useTransportContext } from "../context"

interface DetailViewProps {
  readonly onBack: () => void
}

/**
 * Job detail view with action support.
 * Reads jobId from the route params.
 */
export function DetailView({ onBack }: DetailViewProps) {
  const { jobId } = useParams<{ jobId: string }>()
  const { transport } = useTransportContext()
  const [job, setJob] = useState<Job | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!jobId) {
      return
    }
    try {
      const result = await transport.getJob(jobId)
      setJob(result)
      setErrorMsg(null)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Unknown error")
    }
  }, [transport, jobId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const executeAction = useCallback(
    async (action: string) => {
      if (!job) {
        return
      }
      try {
        switch (action) {
          case "cancel": {
            await transport.cancelJob(job.id, "Cancelled via TUI")
            setMessage("Job cancelled")
            break
          }
          case "retry": {
            await transport.retryJob(job.id)
            setMessage("Job retried")
            break
          }
          case "run-now": {
            await transport.runJobNow(job.id)
            setMessage("Job promoted to run now")
            break
          }
          case "delete": {
            await transport.deleteJob(job.id)
            setMessage("Job deleted")
            setTimeout(() => onBack(), 1000)
            break
          }
          default: {
            break
          }
        }
        await refresh()
      } catch (error) {
        setMessage(
          `Action failed: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    },
    [job, transport, refresh, onBack]
  )

  useInput((input, key) => {
    if (key.escape) {
      if (confirm) {
        setConfirm(null)
      } else {
        onBack()
      }
      return
    }

    if (confirm) {
      if (input === "y") {
        void executeAction(confirm)
      }
      setConfirm(null)
      return
    }

    if (input === "c") {
      setConfirm("cancel")
    } else if (input === "r") {
      setConfirm("retry")
    } else if (input === "n") {
      setConfirm("run-now")
    } else if (input === "d") {
      setConfirm("delete")
    }
  })

  if (errorMsg) {
    return (
      <Box>
        <Text color="red">Error: {errorMsg}</Text>
      </Box>
    )
  }

  if (!job) {
    return (
      <Box>
        <Text color="gray">Loading...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" gap={0}>
        <Field label="ID" value={job.id} />
        <Field label="Name" value={job.name} />
        <Field
          label="Status"
          value={job.status}
          color={getStatusColor(job.status)}
        />
        <Field label="Priority" value={String(job.priority)} />
        <Field
          label="Attempts"
          value={`${job.attempts} / ${job.maxAttempts}`}
        />
        <Field label="Progress" value={`${job.progress}%`} />
        <Field label="Created" value={formatDate(job.createdAt)} />
        <Field label="Process At" value={formatDate(job.processAt)} />
        {job.processedAt && (
          <Field label="Processed" value={formatDate(job.processedAt)} />
        )}
        {job.completedAt && (
          <Field label="Completed" value={formatDate(job.completedAt)} />
        )}
        {job.failedAt && (
          <Field label="Failed At" value={formatDate(job.failedAt)} />
        )}
        {job.error && (
          <Field
            label="Error"
            value={`${job.error.name}: ${job.error.message}`}
            color="red"
          />
        )}
        {job.groupKey && <Field label="Group" value={job.groupKey} />}
        {job.uniqueKey && <Field label="Unique Key" value={job.uniqueKey} />}
        {job.cron && <Field label="Cron" value={job.cron} />}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Payload:</Text>
        <Text color="gray">{JSON.stringify(job.payload, null, 2)}</Text>
      </Box>

      {job.result !== undefined && (
        <Box marginTop={1} flexDirection="column">
          <Text bold>Result:</Text>
          <Text color="gray">{JSON.stringify(job.result, null, 2)}</Text>
        </Box>
      )}

      {confirm && (
        <Box marginTop={1}>
          <Text color="yellow">Confirm {confirm} on this job? [y/n]</Text>
        </Box>
      )}

      {message && !confirm && (
        <Box marginTop={1}>
          <Text color="green">{message}</Text>
        </Box>
      )}
    </Box>
  )
}

function Field({
  label,
  value,
  color,
}: {
  readonly label: string
  readonly value: string
  readonly color?: string
}) {
  return (
    <Box>
      <Box width={14}>
        <Text color="gray">{label}</Text>
      </Box>
      <Text color={color}>{value}</Text>
    </Box>
  )
}

function formatDate(date: Date): string {
  return date instanceof Date ? date.toISOString() : String(date)
}

function getStatusColor(status: string): string {
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
