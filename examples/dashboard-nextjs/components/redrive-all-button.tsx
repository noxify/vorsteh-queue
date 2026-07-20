"use client"

import { RefreshCwIcon } from "lucide-react"
import { useTransition } from "react"

import { redriveAllDeadJobs } from "@/app/actions/mutations"

export function RedriveAllButton({ disabled }: { disabled?: boolean }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => redriveAllDeadJobs())}
      disabled={isPending || disabled}
      className="border-input hover:bg-accent inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
    >
      <RefreshCwIcon className="h-4 w-4" />
      Redrive All
    </button>
  )
}
