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

export function JobActions({
  jobId,
  status,
}: {
  jobId: string
  status: JobStatus
}) {
  const [isPending, startTransition] = useTransition()

  const canCancel =
    status === "pending" || status === "delayed" || status === "processing"
  const canRetry = status === "failed"
  const canRedrive = status === "dead"
  const canRunNow = status === "delayed"
  const canDelete =
    status === "completed" || status === "cancelled" || status === "dead"

  function action(fn: (id: string) => Promise<void>) {
    startTransition(() => fn(jobId))
  }

  return (
    <div className="flex items-center gap-1">
      {canCancel && (
        <button
          type="button"
          onClick={() => action(cancelJob)}
          disabled={isPending}
          title="Cancel job"
          className="hover:bg-accent rounded-md p-1.5 disabled:opacity-50"
        >
          <XCircleIcon className="h-4 w-4" />
        </button>
      )}
      {canRetry && (
        <button
          type="button"
          onClick={() => action(retryJob)}
          disabled={isPending}
          title="Retry job"
          className="hover:bg-accent rounded-md p-1.5 disabled:opacity-50"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </button>
      )}
      {canRedrive && (
        <button
          type="button"
          onClick={() => action(redriveJob)}
          disabled={isPending}
          title="Redrive job"
          className="hover:bg-accent rounded-md p-1.5 disabled:opacity-50"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </button>
      )}
      {canRunNow && (
        <button
          type="button"
          onClick={() => action(runJobNow)}
          disabled={isPending}
          title="Run now"
          className="hover:bg-accent rounded-md p-1.5 disabled:opacity-50"
        >
          <PlayIcon className="h-4 w-4" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => action(deleteJob)}
          disabled={isPending}
          title="Delete job"
          className="hover:bg-accent rounded-md p-1.5 disabled:opacity-50"
        >
          <TrashIcon className="text-destructive h-4 w-4" />
        </button>
      )}
    </div>
  )
}
