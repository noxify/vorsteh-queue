"use client"

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

const statusColors: Record<string, string> = {
  pending: "#3b82f6",
  delayed: "#eab308",
  processing: "#a855f7",
  completed: "#22c55e",
  failed: "#f97316",
  cancelled: "#6b7280",
  dead: "#ef4444",
  "waiting-children": "#8b5cf6",
}

function countLeaves(node: FlowNode): number {
  if (node.children.length === 0) {
    return 1
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0)
}

function buildNodes(
  node: FlowNode,
  nodes: Node[],
  edges: Edge[],
  highlightJobId: string | undefined,
  depth = 0,
  xOffset = 0
): number {
  const width = countLeaves(node)
  const nodeX = xOffset + (width - 1) / 2
  const nodeId = node.job.id
  const isCurrent = nodeId === highlightJobId

  nodes.push({
    id: nodeId,
    position: { x: nodeX * 200, y: depth * 130 },
    data: {
      label: (
        <div className="flex flex-col items-center gap-1 p-1.5">
          <div className="text-[11px] font-medium">{node.job.name}</div>
          <StatusBadge status={node.job.status} />
          <div className="text-muted-foreground font-mono text-[9px]">
            {node.job.id.slice(0, 8)}
          </div>
        </div>
      ),
    },
    style: {
      border: `${isCurrent ? "3px" : "2px"} solid ${statusColors[node.job.status] ?? "#6b7280"}`,
      borderRadius: "8px",
      background: isCurrent ? "var(--accent)" : "var(--card)",
      padding: "2px",
      cursor: "pointer",
      boxShadow: isCurrent ? "0 0 0 2px var(--ring)" : undefined,
    },
  })

  let childOffset = xOffset
  for (const child of node.children) {
    const childId = child.job.id
    edges.push({
      id: `${nodeId}-${childId}`,
      source: nodeId,
      target: childId,
      animated: child.job.status === "processing",
    })
    childOffset += buildNodes(
      child,
      nodes,
      edges,
      highlightJobId,
      depth + 1,
      childOffset
    )
  }

  return width
}

interface FlowGraphProps {
  /** The flow tree data to render. */
  tree: FlowNode
  /** Optional: highlight a specific job node (e.g. the currently viewed job). */
  highlightJobId?: string
  /** Called when a node is clicked. Receives the job ID. */
  onNodeClick?: (jobId: string) => void
  /** Height of the graph container. */
  height?: string
}

export function FlowGraph({
  tree,
  highlightJobId,
  onNodeClick,
  height = "500px",
}: FlowGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = []
    const e: Edge[] = []
    buildNodes(tree, n, e, highlightJobId)
    return { nodes: n, edges: e }
  }, [tree, highlightJobId])

  return (
    <div className="border-border w-full rounded-lg border" style={{ height }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={
            onNodeClick ? (_event, node) => onNodeClick(node.id) : undefined
          }
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
