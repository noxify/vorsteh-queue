"use client"

import type { FlowNodeStatus, FlowTree } from "@vorsteh-queue/core"
import type { Edge, Node } from "@xyflow/react"
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react"
import { useMemo } from "react"

import "@xyflow/react/dist/style.css"

const statusColors: Record<FlowNodeStatus, string> = {
  waiting: "#8b5cf6",
  ready: "#3b82f6",
  completed: "#22c55e",
  failed: "#ef4444",
  cancelled: "#6b7280",
}

function countLeaves(tree: FlowTree): number {
  if (tree.children.length === 0) {
    return 1
  }
  return tree.children.reduce((sum, child) => sum + countLeaves(child), 0)
}

function buildNodes(
  tree: FlowTree,
  nodes: Node[],
  edges: Edge[],
  highlightNodeId: string | undefined,
  depth = 0,
  xOffset = 0
): number {
  const width = countLeaves(tree)
  const nodeX = xOffset + (width - 1) / 2
  const nodeId = tree.node.id
  const isCurrent = nodeId === highlightNodeId

  nodes.push({
    id: nodeId,
    position: { x: nodeX * 200, y: depth * 130 },
    data: {
      label: (
        <div className="flex flex-col items-center gap-1 p-1.5">
          <div className="text-[11px] font-medium">{tree.node.name}</div>
          <div className="text-[10px] font-medium">{tree.node.status}</div>
          <div className="text-muted-foreground font-mono text-[9px]">
            {tree.node.id.slice(0, 8)}
          </div>
        </div>
      ),
    },
    style: {
      border: `${isCurrent ? "3px" : "2px"} solid ${statusColors[tree.node.status] ?? "#6b7280"}`,
      borderRadius: "8px",
      background: isCurrent ? "var(--accent)" : "var(--card)",
      padding: "2px",
      cursor: "pointer",
      boxShadow: isCurrent ? "0 0 0 2px var(--ring)" : undefined,
    },
  })

  let childOffset = xOffset
  for (const child of tree.children) {
    const childId = child.node.id
    edges.push({
      id: `${nodeId}-${childId}`,
      source: nodeId,
      target: childId,
      animated: child.node.status === "ready",
    })
    childOffset += buildNodes(
      child,
      nodes,
      edges,
      highlightNodeId,
      depth + 1,
      childOffset
    )
  }

  return width
}

interface FlowGraphProps {
  /** The flow tree data to render. */
  tree: FlowTree
  /** Optional: highlight a specific node (e.g. the currently viewed flow node). */
  highlightNodeId?: string
  /** Called when a node is clicked. Receives the node ID. */
  onNodeClick?: (nodeId: string) => void
  /** Height of the graph container. */
  height?: string
}

export function FlowGraph({
  tree,
  highlightNodeId,
  onNodeClick,
  height = "500px",
}: FlowGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = []
    const e: Edge[] = []
    buildNodes(tree, n, e, highlightNodeId)
    return { nodes: n, edges: e }
  }, [tree, highlightNodeId])

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
