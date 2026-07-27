"use client"

import type { Job } from "@vorsteh-queue/core"
import { RefreshCwIcon } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTransition } from "react"

import { redriveAllDeadJobs, redriveJob } from "@/app/actions/mutations"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDeadJobs } from "@/hooks/use-queue-data"
import { formatRelativeTime } from "@/lib/utils"

export function DlqView({
  initialData,
  queue,
}: {
  initialData: Job[]
  queue: string
}) {
  const params = useParams()
  const currentQueue = (params.queue as string) ?? queue
  const { data: deadJobs } = useDeadJobs(
    currentQueue,
    { limit: 50 },
    initialData
  )
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dead Letter Queue
          </h1>
          <p className="text-muted-foreground">
            Jobs that exceeded max attempts
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            startTransition(() => redriveAllDeadJobs(currentQueue))
          }
          disabled={isPending || !deadJobs || deadJobs.length === 0}
        >
          <RefreshCwIcon className="h-4 w-4" />
          Redrive All
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>Failed At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deadJobs && deadJobs.length > 0 ? (
              deadJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Link
                      href={`/${currentQueue}/jobs/${job.id}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {job.name}
                    </Link>
                    <div className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {job.id.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {job.error?.message ?? "Unknown error"}
                  </TableCell>
                  <TableCell>
                    {job.attempts}/{job.maxAttempts}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.failedAt
                      ? formatRelativeTime(new Date(job.failedAt))
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        startTransition(() => redriveJob(job.id, currentQueue))
                      }
                      disabled={isPending}
                    >
                      <RefreshCwIcon className="h-3 w-3" />
                      Redrive
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-12 text-center"
                >
                  No dead jobs — everything is healthy
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
