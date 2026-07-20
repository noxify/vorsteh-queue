import type { Job } from "@vorsteh-queue/core"
import { Box, Text, useInput } from "ink"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "../components/ui/badge"
import { Dialog } from "../components/ui/dialog"
import { JSONView } from "../components/ui/json"
import { Spinner } from "../components/ui/spinner"
import { useDashboard } from "../context"
import { useClipboard } from "../hooks/use-clipboard"

interface JobDetailDrawerProps {
  readonly isFocused: boolean
}

/**
 * Job detail drawer — slides in from the right when a job is selected.
 * Provides actions (cancel, retry, run now, delete) and clipboard support.
 */
// oxlint-disable-next-line complexity -- many optional job fields to display
export function JobDetailDrawer({ isFocused }: JobDetailDrawerProps) {
  const { transport, selectedJobId, goBack, openFlowTree } = useDashboard()
  const { write: copyToClipboard } = useClipboard()
  const [job, setJob] = useState<Job | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!selectedJobId) {
      return
    }
    try {
      const result = await transport.getJob(selectedJobId)
      setJob(result)
      setErrorMsg(null)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Unknown error")
    }
  }, [transport, selectedJobId])

  useEffect(() => {
    setJob(null)
    setMessage(null)
    setConfirmAction(null)
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
            setTimeout(() => goBack(), 1000)
            break
          }
          default: {
            break
          }
        }
        await refresh()
      } catch (error) {
        setMessage(
          `Failed: ${error instanceof Error ? error.message : "Unknown error"}`
        )
      }
    },
    [job, transport, refresh, goBack]
  )

  useInput((input, key) => {
    if (!isFocused || confirmAction) {
      return
    }

    if (key.escape) {
      goBack()
      return
    }

    // Actions
    if (input === "c") {
      setConfirmAction("cancel")
    } else if (input === "r") {
      setConfirmAction("retry")
    } else if (input === "n") {
      setConfirmAction("run-now")
    } else if (input === "x") {
      setConfirmAction("delete")
    } else if (input === "f") {
      if (job?.flowId) {
        openFlowTree(job.flowId)
      } else if (job) {
        setMessage("Job is not part of a flow")
        setTimeout(() => setMessage(null), 2000)
      }
    }

    // Clipboard shortcuts
    if (input === "y" && job) {
      copyToClipboard(job.id)
      setMessage("Job ID copied")
      setTimeout(() => setMessage(null), 2000)
    } else if (input === "p" && job) {
      copyToClipboard(JSON.stringify(job.payload, null, 2))
      setMessage("Payload copied")
      setTimeout(() => setMessage(null), 2000)
    }
  })

  const borderColor = isFocused ? "#f97316" : "gray"

  return (
    <Box
      flexDirection="column"
      width={48}
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
    >
      <Box justifyContent="space-between">
        <Text bold color="#f97316">
          Job Detail
        </Text>
        <Text color="gray" dimColor>
          Esc close
        </Text>
      </Box>

      {errorMsg && (
        <Box>
          <Text color="red">Error: {errorMsg}</Text>
        </Box>
      )}

      {!job && !errorMsg && <Spinner label="Loading..." />}

      {job && (
        <Box flexDirection="column">
          <Field label="ID" value={job.id} />
          <Field label="Name" value={job.name} />
          <Box flexDirection="column" marginBottom={0}>
            <Text color="gray" dimColor>
              Status
            </Text>
            <Badge variant={getStatusVariant(job.status)} bordered={false} bold>
              {job.status}
            </Badge>
          </Box>
          <Field label="Priority" value={String(job.priority)} />
          <Field
            label="Attempts"
            value={`${job.attempts}/${job.maxAttempts}`}
          />
          <Field label="Progress" value={`${job.progress}%`} />

          {/* Timestamps */}
          <Field label="Created" value={formatDate(job.createdAt)} />
          <Field label="Process At" value={formatDate(job.processAt)} />
          {job.processedAt && (
            <Field label="Started" value={formatDate(job.processedAt)} />
          )}
          {job.completedAt && (
            <Field label="Completed" value={formatDate(job.completedAt)} />
          )}
          {job.failedAt && (
            <Field label="Failed At" value={formatDate(job.failedAt)} />
          )}
          {job.cancelledAt && (
            <Field label="Cancelled At" value={formatDate(job.cancelledAt)} />
          )}

          {/* Error */}
          {job.error && (
            <Field
              label="Error"
              value={`${job.error.name}: ${job.error.message}`}
              color="red"
            />
          )}
          {job.cancellationReason && (
            <Field label="Cancel Reason" value={job.cancellationReason} />
          )}

          {/* Scheduling */}
          {job.cron && <Field label="Cron" value={job.cron} />}
          {job.repeatEvery && (
            <Field label="Repeat Every" value={`${job.repeatEvery}ms`} />
          )}
          {job.repeatLimit && (
            <Field label="Repeat Limit" value={String(job.repeatLimit)} />
          )}
          {job.repeatCount > 0 && (
            <Field label="Repeat Count" value={String(job.repeatCount)} />
          )}
          {job.timeout !== undefined && (
            <Field
              label="Timeout"
              value={job.timeout === false ? "disabled" : `${job.timeout}ms`}
            />
          )}

          {/* Grouping & Deduplication */}
          {job.groupKey && <Field label="Group" value={job.groupKey} />}
          {job.uniqueKey && <Field label="Unique Key" value={job.uniqueKey} />}

          {/* Dependencies & Flows */}
          {job.dependsOn && job.dependsOn.length > 0 && (
            <Field label="Depends On" value={job.dependsOn.join(", ")} />
          )}
          {job.onDependencyFailure && job.onDependencyFailure !== "fail" && (
            <Field label="On Dep Failure" value={job.onDependencyFailure} />
          )}
          {job.parentId && <Field label="Parent ID" value={job.parentId} />}
          {job.flowId && <Field label="Flow ID" value={job.flowId} />}
          {job.childrenCount !== undefined && job.childrenCount > 0 && (
            <Field
              label="Children"
              value={`${job.childrenCompleted ?? 0}/${job.childrenCount} completed`}
            />
          )}

          {/* Payload & Result */}
          <Box marginTop={1}>
            <JSONView data={job.payload} label="Payload" collapsed />
          </Box>

          {job.result !== undefined && (
            <Box marginTop={1}>
              <JSONView data={job.result} label="Result" collapsed />
            </Box>
          )}

          {message && (
            <Box marginTop={1}>
              <Text color="green">{message}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <Dialog
          isOpen
          title={`${confirmAction} job?`}
          variant={confirmAction === "delete" ? "danger" : "default"}
          confirmLabel="Yes"
          cancelLabel="No"
          onConfirm={() => {
            void executeAction(confirmAction)
            setConfirmAction(null)
          }}
          onCancel={() => setConfirmAction(null)}
        >
          <Text>Are you sure you want to {confirmAction} this job?</Text>
        </Dialog>
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
    <Box flexDirection="column" marginBottom={0}>
      <Text color="gray" dimColor>
        {label}
      </Text>
      <Text color={color}>{value}</Text>
    </Box>
  )
}

function formatDate(date: Date): string {
  if (!(date instanceof Date)) {
    return String(date)
  }
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
}

function getStatusVariant(
  status: string
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
