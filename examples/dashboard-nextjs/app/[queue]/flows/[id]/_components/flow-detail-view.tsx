"use client"

import type { FlowTree } from "@vorsteh-queue/core"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { FlowGraph } from "@/components/flow-graph"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFlowTree } from "@/hooks/use-queue-data"

export function FlowDetailView({
  flowId,
  initialData,
  queue,
}: {
  flowId: string
  initialData: FlowTree
  queue: string
}) {
  const router = useRouter()
  const { data: tree } = useFlowTree(queue, flowId, initialData)
  if (!tree) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/${queue}/flows`}
          className="hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-lg"
        >
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tree.node.name}
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {flowId}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flow Graph</CardTitle>
        </CardHeader>
        <CardContent>
          <FlowGraph
            tree={tree}
            onNodeClick={(nodeId) =>
              router.push(`/${queue}/flows/${flowId}#${nodeId}`)
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
