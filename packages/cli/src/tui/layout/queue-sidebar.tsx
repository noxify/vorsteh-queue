import { Box, Text, useInput } from "ink"
import { useState } from "react"

import { useDashboard } from "../context"

interface QueueSidebarProps {
  readonly queues: readonly string[]
  readonly badges: Record<string, number>
  readonly isFocused: boolean
}

type SidebarView = "overview" | "jobs" | "dead"

const VIEWS: readonly SidebarView[] = ["overview", "jobs", "dead"]

/**
 * Left sidebar with queue list and view switcher.
 * Active when the sidebar pane has focus.
 */
export function QueueSidebar({ queues, badges, isFocused }: QueueSidebarProps) {
  const {
    activeQueue,
    activeView,
    setActiveQueue,
    setActiveView,
    setFocusPane,
  } = useDashboard()
  const [section, setSection] = useState<"queues" | "views">("queues")
  const [queueIndex, setQueueIndex] = useState(0)
  const [viewIndex, setViewIndex] = useState(0)

  useInput((input, key) => {
    if (!isFocused) {
      return
    }

    if (key.upArrow) {
      if (section === "queues") {
        setQueueIndex((i) => Math.max(0, i - 1))
      } else if (viewIndex === 0) {
        // Move back to queues section from top of views
        setSection("queues")
        setQueueIndex(queues.length - 1)
      } else {
        setViewIndex((i) => i - 1)
      }
    } else if (key.downArrow) {
      if (section === "queues") {
        if (queueIndex < queues.length - 1) {
          setQueueIndex((i) => i + 1)
        } else {
          // Move to views section
          setSection("views")
          setViewIndex(0)
        }
      } else {
        setViewIndex((i) => Math.min(VIEWS.length - 1, i + 1))
      }
    } else if (key.return) {
      if (section === "queues") {
        const selected = queues[queueIndex]
        if (selected) {
          setActiveQueue(selected)
        }
      } else {
        const selected = VIEWS[viewIndex]
        if (selected) {
          setActiveView(selected)
        }
      }
      setFocusPane("content")
    }
  })

  const borderColor = isFocused ? "#f97316" : "gray"

  return (
    <Box
      flexDirection="column"
      width={28}
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
    >
      {/* Queue List */}
      <Box marginBottom={0}>
        <Text bold color={isFocused ? "#f97316" : "white"}>
          Queues
        </Text>
      </Box>
      {queues.map((q, idx) => {
        const isActive = q === activeQueue
        const isCursor = isFocused && section === "queues" && idx === queueIndex
        const badge = badges[q]
        return (
          <Box key={q} flexDirection="row">
            <Text color={isCursor ? "#f97316" : "transparent"}>
              {isCursor ? "›" : " "}
            </Text>
            <Text> </Text>
            <Text
              color={isActive ? "#f97316" : isCursor ? "white" : "gray"}
              bold={isActive}
            >
              {isActive ? "●" : "○"} {truncate(q, 18)}
            </Text>
            {badge !== undefined && badge > 0 && (
              <Box flexGrow={1} justifyContent="flex-end">
                <Text color="gray">{badge}</Text>
              </Box>
            )}
          </Box>
        )
      })}

      {/* Divider */}
      <Box marginY={1}>
        <Text color="gray">{"─".repeat(24)}</Text>
      </Box>

      {/* View Switcher */}
      <Box marginBottom={0}>
        <Text bold color={isFocused ? "#f97316" : "white"}>
          Views
        </Text>
      </Box>
      {VIEWS.map((v, idx) => {
        const isActive = v === activeView
        const isCursor = isFocused && section === "views" && idx === viewIndex
        return (
          <Box key={v} flexDirection="row">
            <Text color={isCursor ? "#f97316" : "transparent"}>
              {isCursor ? "›" : " "}
            </Text>
            <Text> </Text>
            <Text
              color={isActive ? "#f97316" : isCursor ? "white" : "gray"}
              bold={isActive}
            >
              {isActive ? "▸" : " "} {viewLabel(v)}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}

function viewLabel(view: SidebarView): string {
  switch (view) {
    case "overview": {
      return "Overview"
    }
    case "jobs": {
      return "Jobs"
    }
    case "dead": {
      return "Dead Letter"
    }
    default: {
      return view
    }
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str
}
