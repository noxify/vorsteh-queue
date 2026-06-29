import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PlayIcon, RefreshCwIcon, TrashIcon, XCircleIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { request } from "~/lib/api-client"
import {
  CancelJobMutation,
  DeleteJobMutation,
  RedriveJobMutation,
  RetryJobMutation,
  RunJobNowMutation,
} from "~/lib/graphql"

interface JobActionsProps {
  readonly jobId: string
  readonly status: string
}

/**
 * Action buttons for a job with confirmation dialogs.
 */
export function JobActions({ jobId, status }: JobActionsProps) {
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<string | null>(null)

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["jobs"] })
    queryClient.invalidateQueries({ queryKey: ["job", jobId] })
    queryClient.invalidateQueries({ queryKey: ["stats"] })
    queryClient.invalidateQueries({ queryKey: ["dead-jobs"] })
  }

  const cancelMutation = useMutation({
    mutationFn: () => request(CancelJobMutation, { id: jobId }),
    onSuccess: invalidateAll,
  })

  const retryMutation = useMutation({
    mutationFn: () => request(RetryJobMutation, { id: jobId }),
    onSuccess: invalidateAll,
  })

  const redriveMutation = useMutation({
    mutationFn: () => request(RedriveJobMutation, { id: jobId }),
    onSuccess: invalidateAll,
  })

  const runNowMutation = useMutation({
    mutationFn: () => request(RunJobNowMutation, { id: jobId }),
    onSuccess: invalidateAll,
  })

  const deleteMutation = useMutation({
    mutationFn: () => request(DeleteJobMutation, { id: jobId }),
    onSuccess: invalidateAll,
  })

  const canCancel =
    status === "pending" || status === "delayed" || status === "processing"
  const canRetry = status === "failed"
  const canRedrive = status === "dead"
  const canRunNow = status === "delayed"
  const canDelete =
    status === "completed" || status === "cancelled" || status === "dead"

  return (
    <div className="flex items-center gap-1">
      {canCancel && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
          title="Cancel job"
        >
          <XCircleIcon className="h-4 w-4" />
        </Button>
      )}

      {canRetry && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => retryMutation.mutate()}
          disabled={retryMutation.isPending}
          title="Retry job"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      )}

      {canRedrive && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => redriveMutation.mutate()}
          disabled={redriveMutation.isPending}
          title="Redrive job"
        >
          <RefreshCwIcon className="h-4 w-4" />
        </Button>
      )}

      {canRunNow && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => runNowMutation.mutate()}
          disabled={runNowMutation.isPending}
          title="Run now"
        >
          <PlayIcon className="h-4 w-4" />
        </Button>
      )}

      {canDelete && (
        <Dialog
          open={confirmAction === "delete"}
          onOpenChange={(open) => setConfirmAction(open ? "delete" : null)}
        >
          <DialogTrigger
            render={
              <Button variant="ghost" size="icon" title="Delete job">
                <TrashIcon className="text-destructive h-4 w-4" />
              </Button>
            }
          />
          <DialogPopup>
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this job? This action
              cannot be undone.
            </DialogDescription>
            <div className="flex justify-end gap-2 pt-4">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate()
                  setConfirmAction(null)
                }}
              >
                Delete
              </Button>
            </div>
          </DialogPopup>
        </Dialog>
      )}
    </div>
  )
}
