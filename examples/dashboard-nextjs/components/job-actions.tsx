"use client"

import type { JobStatus } from "@vorsteh-queue/core"
import { PlayIcon, RefreshCwIcon, TrashIcon, XCircleIcon } from "lucide-react"
import { useTransition } from "react"

import {
  cancelJob,
  deleteJob,
  redriveJob,
  retryJob,
  runJobNow,
} from "@/app/actions/mutations"
import { Button } from "@/components/ui/button"

export function JobActions({
  jobId,
  status,
  queue,
}: {
  jobId: string
  status: JobStatus
  queue: string
}) {
  const [isPending, startTransition] = useTransition()

  const canCancel =
    status === "pending" || status === "delayed" || status === "processing"
  const canRetry = status === "failed"
  const canRedrive = status === "dead"
  const canRunNow = status === "delayed"
  const canDelete =
    status === "completed" || status === "cancelled" || status === "dead"

  function action(fn: (id: string, q?: string) => Promise<void>) {
    startTransition(() => fn(jobId, queue))
  }

  return (
    <div className="flex items-center gap-1">
      {canCancel && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => action(cancelJob)}
          disabled={isPending}
          title="Cancel job"
        >
          <XCircleIcon className="h-4 w-4" />
        </Button>
      )}
      {canRetry && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => action(retryJob)}
          disabled={isPending}
          title="Retry job"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      )}
      {canRedrive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => action(redriveJob)}
          disabled={isPending}
          title="Redrive job"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      )}
      {canRunNow && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => action(runJobNow)}
          disabled={isPending}
          title="Run now"
        >
          <PlayIcon className="h-4 w-4" />
        </Button>
      )}
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => action(deleteJob)}
          disabled={isPending}
          title="Delete job"
        >
          <TrashIcon className="text-destructive h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
