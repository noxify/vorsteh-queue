import type { FlowNode } from "@vorsteh-queue/core"
import type { Edge, Node } from "@xyflow/react"
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react"
import { useMemo } from "react"

import { StatusBadge } from "@/components/status-badge"

import "@xyflow/react/dist/style.css"

interface FlowGraphProps {
  /** The root node of the flow tree. */
  readonly tree: FlowNode
}

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

function flattenTree(
  node: FlowNode,
  nodes: Node[],
  edges: Edge[],
  depth = 0,
  index = 0
): void {
  const nodeId = node.job.id

  nodes.push({
    id: nodeId,
    position: { x: index * 220, y: depth * 120 },
    data: {
      label: (
        <div className="flex flex-col items-center gap-1 p-2">
          <div className="text-xs font-medium">{node.job.name}</div>
          <StatusBadge status={node.job.status} />
        </div>
      ),
    },
    style: {
      border: `2px solid ${statusColors[node.job.status] ?? "#6b7280"}`,
      borderRadius: "8px",
      background: "var(--card)",
      padding: "4px",
    },
  })

  for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
    const child = node.children[childIndex]
    if (!child) {
      continue
    }
    const childId = child.job.id

    edges.push({
      id: `${nodeId}-${childId}`,
      source: nodeId,
      target: childId,
      animated: child.job.status === "processing",
    })

    flattenTree(child, nodes, edges, depth + 1, index + childIndex)
  }
}

/**
 * Visual flow graph displaying parent-child job relationships using ReactFlow.
 *
 * @example
 * ```tsx
 * <FlowGraph tree={flowTreeData} />
 * ```
 */
export function FlowGraph({ tree }: FlowGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = []
    const e: Edge[] = []
    flattenTree(tree, n, e)
    return { nodes: n, edges: e }
  }, [tree])

  return (
    <div className="border-border h-125 w-full rounded-lg border">
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
