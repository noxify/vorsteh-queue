import type { FlowTree } from "@vorsteh-queue/core"
import { Box, Text, useInput } from "ink"
import { useEffect, useState } from "react"

import { Badge } from "../components/ui/badge"
import { Spinner } from "../components/ui/spinner"
import { useTheme } from "../components/ui/theme-provider"
import { useDashboard } from "../context"

interface FlowTreeOverlayProps {
  readonly flowId: string
  readonly isOpen: boolean
  readonly onClose: () => void
}

const STATUS_ICONS: Record<string, string> = {
  cancelled: "⊘",
  completed: "✓",
  failed: "✗",
  ready: "○",
  waiting: "⏳",
}

const STATUS_COLORS: Record<string, string> = {
  cancelled: "gray",
  completed: "green",
  failed: "red",
  ready: "yellow",
  waiting: "#f97316",
}

/**
 * Full-screen overlay showing the flow tree for a specific flowId.
 * Triggered from job detail or job list when a job belongs to a flow.
 */
export function FlowTreeOverlay({
  flowId,
  isOpen,
  onClose,
}: FlowTreeOverlayProps) {
  const theme = useTheme()
  const { transport, refreshInterval } = useDashboard()
  const [flowTree, setFlowTree] = useState<FlowTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    let mounted = true

    const loadTree = async () => {
      try {
        const tree = await transport.getFlowTree(flowId)
        if (mounted) {
          setFlowTree(tree)
          setErrorMsg(null)
          setLoading(false)
        }
      } catch (error) {
        if (mounted) {
          setErrorMsg(error instanceof Error ? error.message : "Unknown error")
          setLoading(false)
        }
      }
    }

    setLoading(true)
    void loadTree()
    const timer = setInterval(() => void loadTree(), refreshInterval)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [isOpen, flowId, transport, refreshInterval])

  useInput((input, key) => {
    if (!isOpen) {
      return
    }
    if (key.escape || input === "f") {
      onClose()
    }
  })

  if (!isOpen) {
    return null
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.colors.primary}
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          Flow Tree
        </Text>
        <Text color={theme.colors.mutedForeground}>
          {" "}
          — {flowId.slice(0, 8)}...
        </Text>
        <Box flexGrow={1} />
        <Text color={theme.colors.mutedForeground}>Esc or f to close</Text>
      </Box>

      {loading && !flowTree ? (
        <Spinner label="Loading flow tree..." />
      ) : errorMsg ? (
        <Text color="red">Error: {errorMsg}</Text>
      ) : flowTree ? (
        <FlowTreeRenderer tree={flowTree} />
      ) : (
        <Text color="red">Flow not found.</Text>
      )}
    </Box>
  )
}

// ─── Flow Tree Renderer ──────────────────────────────────────────────────────

interface TreeLine {
  readonly key: string
  readonly prefix: string
  readonly connector: string
  readonly icon: string
  readonly color: string
  readonly name: string
  readonly status: string
  readonly statusVariant:
    | "default"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "secondary"
  readonly suffix: string
}

function collectTreeLines(
  tree: FlowTree,
  prefix: string,
  isLast: boolean,
  isRoot: boolean
): TreeLine[] {
  const { node } = tree
  const icon = STATUS_ICONS[node.status] ?? "?"
  const color = STATUS_COLORS[node.status] ?? "white"
  const connector = isRoot ? "" : isLast ? "└── " : "├── "
  const childPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ")

  const childrenProgress =
    node.childrenCount > 0
      ? ` [${node.childrenCompleted}/${node.childrenCount}]`
      : ""
  const suffix = childrenProgress

  const lines: TreeLine[] = [
    {
      color,
      connector,
      icon,
      key: node.id,
      name: node.name,
      prefix,
      status: node.status,
      statusVariant: getStatusVariant(node.status),
      suffix,
    },
  ]

  const children = tree.children ?? []
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!child) {
      continue
    }
    const childIsLast = i === children.length - 1
    lines.push(...collectTreeLines(child, childPrefix, childIsLast, false))
  }

  return lines
}

function FlowTreeRenderer({ tree }: { readonly tree: FlowTree }) {
  const lines = collectTreeLines(tree, "", true, true)

  return (
    <Box flexDirection="column">
      {lines.map((line) => (
        <Box key={line.key}>
          <Text color="gray">
            {line.prefix}
            {line.connector}
          </Text>
          <Text color={line.color}>{line.icon} </Text>
          <Text bold>{line.name}</Text>
          <Text color="gray"> </Text>
          <Badge variant={line.statusVariant} bordered={false}>
            {line.status}
          </Badge>
          {line.suffix && <Text color="gray">{line.suffix}</Text>}
        </Box>
      ))}
    </Box>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusVariant(
  status: string
): "default" | "success" | "warning" | "error" | "info" | "secondary" {
  switch (status) {
    case "completed": {
      return "success"
    }
    case "failed": {
      return "error"
    }
    case "ready": {
      return "warning"
    }
    case "waiting": {
      return "info"
    }
    case "cancelled": {
      return "secondary"
    }
    default: {
      return "default"
    }
  }
}
