import type { JobStatus } from "@vorsteh-queue/core"
import { PlayIcon, RefreshCwIcon, TrashIcon, XCircleIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

interface JobActionsProps {
  /** The current status of the job (determines which actions are available). */
  readonly status: JobStatus
  /** Whether any mutation is currently in progress. */
  readonly isPending?: boolean
  /** Called when the user confirms cancellation. */
  readonly onCancel?: () => void
  /** Called when the user triggers a retry. */
  readonly onRetry?: () => void
  /** Called when the user triggers a redrive (from dead letter queue). */
  readonly onRedrive?: () => void
  /** Called when the user triggers "run now" (for delayed jobs). */
  readonly onRunNow?: () => void
  /** Called when the user confirms deletion. */
  readonly onDelete?: () => void
}

/**
 * Action buttons for job operations with a confirmation dialog for destructive actions.
 *
 * The available actions are determined by the job's current status:
 * - Cancel: pending, delayed, processing
 * - Retry: failed
 * - Redrive: dead
 * - Run Now: delayed
 * - Delete: completed, cancelled, dead
 *
 * @example
 * ```tsx
 * <JobActions
 *   status="failed"
 *   onRetry={() => retryJob(id)}
 *   onDelete={() => deleteJob(id)}
 * />
 * ```
 */
export function JobActions({
  status,
  isPending = false,
  onCancel,
  onRetry,
  onRedrive,
  onRunNow,
  onDelete,
}: JobActionsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const canCancel =
    status === "pending" || status === "delayed" || status === "processing"
  const canRetry = status === "failed"
  const canRedrive = status === "dead"
  const canRunNow = status === "delayed"
  const canDelete =
    status === "completed" || status === "cancelled" || status === "dead"

  return (
    <div className="flex items-center gap-1">
      {canCancel && onCancel && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          disabled={isPending}
          title="Cancel job"
        >
          <XCircleIcon className="h-4 w-4" />
        </Button>
      )}

      {canRetry && onRetry && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRetry}
          disabled={isPending}
          title="Retry job"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      )}

      {canRedrive && onRedrive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRedrive}
          disabled={isPending}
          title="Redrive job"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      )}

      {canRunNow && onRunNow && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRunNow}
          disabled={isPending}
          title="Run now"
        >
          <PlayIcon className="h-4 w-4" />
        </Button>
      )}

      {canDelete && onDelete && showDeleteConfirm && (
        <div className="flex items-center gap-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete()
              setShowDeleteConfirm(false)
            }}
            disabled={isPending}
          >
            Confirm
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            Cancel
          </Button>
        </div>
      )}

      {canDelete && onDelete && !showDeleteConfirm && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowDeleteConfirm(true)}
          title="Delete job"
        >
          <TrashIcon className="text-destructive h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
