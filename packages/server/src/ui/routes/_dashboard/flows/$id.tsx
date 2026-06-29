import { queryOptions, useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react"
import type { Edge, Node } from "@xyflow/react"
import { ArrowLeftIcon } from "lucide-react"
import { useMemo } from "react"

import { StatusBadge } from "~/components/status-badge"
import { Button } from "~/components/ui/button"
import { request } from "~/lib/api-client"
import { FlowTreeQuery } from "~/lib/graphql"

import "@xyflow/react/dist/style.css"

function flowTreeQueryOptions(flowId: string) {
  return queryOptions({
    queryKey: ["flow-tree", flowId],
    queryFn: () => request(FlowTreeQuery, { flowId }),
    refetchInterval: 5000,
  })
}

export const Route = createFileRoute("/_dashboard/flows/$id")({
  component: FlowDetailPage,
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(flowTreeQueryOptions(params.id)),
})

const statusColors: Record<string, string> = {
  pending: "#3b82f6",
  delayed: "#eab308",
  processing: "#a855f7",
  completed: "#22c55e",
  failed: "#f97316",
  cancelled: "#6b7280",
  dead: "#ef4444",
  waiting_children: "#8b5cf6",
}

interface FlowNodeData {
  readonly job: {
    id: string | null
    name: string | null
    status: string | null
  }
  readonly children: readonly FlowNodeData[]
}

function flattenTree(
  node: FlowNodeData,
  nodes: Node[],
  edges: Edge[],
  depth = 0,
  index = 0
): void {
  const nodeId = node.job.id ?? `node-${depth}-${index}`
  nodes.push({
    id: nodeId,
    position: { x: index * 220, y: depth * 120 },
    data: {
      label: (
        <div className="flex flex-col items-center gap-1 p-2">
          <div className="text-xs font-medium">{node.job.name}</div>
          <StatusBadge status={node.job.status ?? "pending"} />
        </div>
      ),
    },
    style: {
      border: `2px solid ${statusColors[node.job.status ?? "pending"] ?? "#6b7280"}`,
      borderRadius: "8px",
      background: "var(--card)",
      padding: "4px",
    },
  })

  if (node.children) {
    for (
      let childIndex = 0;
      childIndex < node.children.length;
      childIndex += 1
    ) {
      // oxlint-disable-next-line typescript/no-non-null-assertion
      const child = node.children[childIndex]!
      const childId = child.job.id ?? `node-${depth + 1}-${childIndex}`
      edges.push({
        id: `${nodeId}-${childId}`,
        source: nodeId,
        target: childId,
        animated: child.job.status === "processing",
      })
      flattenTree(child, nodes, edges, depth + 1, index + childIndex)
    }
  }
}

function FlowGraph({ tree }: { readonly tree: FlowNodeData }) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = []
    const e: Edge[] = []
    flattenTree(tree, n, e)
    return { nodes: n, edges: e }
  }, [tree])

  return (
    <div className="border-border h-[500px] w-full rounded-lg border">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

function FlowDetailPage() {
  const { id } = Route.useParams()
  const { data } = useQuery(flowTreeQueryOptions(id))
  const tree = data?.flowTree

  if (!tree) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center">
        Flow not found
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/flows">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {tree.job?.name}
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{id}</p>
        </div>
      </div>

      <FlowGraph tree={tree as unknown as FlowNodeData} />
    </div>
  )
}
