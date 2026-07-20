import type { FlowNode, Job } from "@vorsteh-queue/core"
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
  dead: "☠",
  delayed: "◷",
  failed: "✗",
  pending: "○",
  processing: "⟳",
  "waiting-children": "⏳",
}

const STATUS_COLORS: Record<string, string> = {
  cancelled: "gray",
  completed: "green",
  dead: "magenta",
  delayed: "blue",
  failed: "red",
  pending: "yellow",
  processing: "cyan",
  "waiting-children": "#f97316",
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
  const [flowTree, setFlowTree] = useState<FlowNode | null>(null)
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
        <FlowTreeRenderer node={flowTree} />
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
  node: FlowNode,
  prefix: string,
  isLast: boolean,
  isRoot: boolean
): TreeLine[] {
  const icon = STATUS_ICONS[node.job.status] ?? "?"
  const color = STATUS_COLORS[node.job.status] ?? "white"
  const connector = isRoot ? "" : isLast ? "└── " : "├── "
  const childPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ")

  const childrenProgress =
    node.job.childrenCount && node.job.childrenCount > 0
      ? ` [${node.job.childrenCompleted ?? 0}/${node.job.childrenCount}]`
      : ""
  const stepsInfo = getStepsInfo(node.job)
  const suffix = `${childrenProgress}${stepsInfo ? ` ${stepsInfo}` : ""}`

  const lines: TreeLine[] = [
    {
      color,
      connector,
      icon,
      key: node.job.id,
      name: node.job.name,
      prefix,
      status: node.job.status,
      statusVariant: getStatusVariant(node.job.status),
      suffix,
    },
  ]

  const children = node.children ?? []
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

function FlowTreeRenderer({ node }: { readonly node: FlowNode }) {
  const lines = collectTreeLines(node, "", true, true)

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

interface StepInfo {
  readonly name: string
  readonly status: string
}

function getStepsInfo(job: Job): string | null {
  if (!job.steps || job.steps.length === 0) {
    return null
  }
  const completed = job.steps.filter(
    (s: StepInfo) => s.status === "completed"
  ).length
  const total = job.steps.length
  const running = job.steps.find(
    (s: StepInfo) => s.status === "running" || s.status === "waiting"
  )
  if (running) {
    return `step: ${running.name} (${completed}/${total})`
  }
  return `steps: ${completed}/${total}`
}

function getStatusVariant(
  status: string
): "default" | "success" | "warning" | "error" | "info" | "secondary" {
  switch (status) {
    case "completed": {
      return "success"
    }
    case "failed":
    case "dead": {
      return "error"
    }
    case "pending":
    case "delayed": {
      return "warning"
    }
    case "processing": {
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
