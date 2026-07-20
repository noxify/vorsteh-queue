import type { FlowNode } from "@vorsteh-queue/core"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { StatusBadge } from "@/components/status-badge"
import { getQueueClient } from "@/lib/queue-client"

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getQueueClient()
  const tree = await client.getFlowTree(id)

  if (!tree) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/flows" className="hover:bg-accent rounded-md p-2">
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tree.job.name}</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{id}</p>
        </div>
      </div>

      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h2 className="mb-4 font-semibold">Flow Tree</h2>
        <FlowTreeView node={tree} depth={0} />
      </div>
    </div>
  )
}

function FlowTreeView({ node, depth }: { node: FlowNode; depth: number }) {
  return (
    <div style={{ paddingLeft: `${depth * 24}px` }}>
      <div className="border-border mb-2 flex items-center gap-2 rounded-md border px-3 py-2">
        <span className="text-sm font-medium">{node.job.name}</span>
        <StatusBadge status={node.job.status} />
        <span className="text-muted-foreground font-mono text-xs">
          {node.job.id.slice(0, 8)}
        </span>
      </div>
      {node.children.map((child) => (
        <FlowTreeView key={child.job.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}
