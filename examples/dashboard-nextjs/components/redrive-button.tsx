"use client"

import { RefreshCwIcon } from "lucide-react"
import { useTransition } from "react"

import { redriveJob } from "@/app/actions/mutations"

export function RedriveButton({ jobId }: { jobId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => redriveJob(jobId))}
      disabled={isPending}
      className="border-input hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
    >
      <RefreshCwIcon className="h-3 w-3" />
      Redrive
    </button>
  )
}
