import type { QueueStats } from "@vorsteh-queue/core"
import { Box, Text, useApp, useInput, useStdout } from "ink"
import { useCallback, useEffect, useState } from "react"

import type { MultiQueueTransport } from "../transport/multi-queue"
import { Spinner } from "./components/ui/spinner"
import { ThemeProvider } from "./components/ui/theme-provider"
import { DashboardProvider, useDashboard } from "./context"
import { ContentPane } from "./layout/content-pane"
import { DashboardCommandPalette } from "./layout/dashboard-command-palette"
import { FlowTreeOverlay } from "./layout/flow-tree-overlay"
import { HelpOverlay } from "./layout/help-overlay"
import { QueueSidebar } from "./layout/queue-sidebar"

interface AppProps {
  readonly transport: MultiQueueTransport
  readonly refreshInterval: number
  readonly initialQueue?: string
  readonly showSidebar?: boolean
}

/**
 * Root TUI dashboard application.
 * Multi-queue layout with sidebar navigation and content pane.
 */
export function App({
  transport,
  refreshInterval,
  initialQueue,
  showSidebar = true,
}: AppProps) {
  return (
    <ThemeProvider>
      <DashboardProvider
        transport={transport}
        refreshInterval={refreshInterval}
        initialQueue={initialQueue}
        showSidebar={showSidebar}
      >
        <DashboardShell />
      </DashboardProvider>
    </ThemeProvider>
  )
}

function DashboardShell() {
  const { exit } = useApp()
  const {
    activeQueue,
    closeFlowTree,
    flowOverlayId,
    focusPane,
    inputActive,
    queues,
    selectedJobId,
    setActiveQueue,
    setActiveView,
    setFocusPane,
    setQueues,
    showSidebar,
    transport,
  } = useDashboard()
  const { stdout } = useStdout()
  const columns = stdout?.columns ?? 80
  const rows = stdout?.rows ?? 24
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Record<string, QueueStats>>({})
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const closePalette = useCallback(() => setPaletteOpen(false), [])
  // Load available queues on mount
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const available = await transport.getQueues()
        if (mounted && available.length > 0) {
          setQueues(available)
          if (!activeQueue) {
            const [firstQueue] = available
            if (firstQueue) {
              setActiveQueue(firstQueue)
            }
          }
        }
      } catch {
        // Will retry on next refresh
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      mounted = false
    }
    // Only run on mount — transport is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transport])

  // Refresh stats for all queues periodically (for sidebar badges)
  useEffect(() => {
    if (queues.length === 0) {
      return
    }

    let mounted = true
    const refreshStats = async () => {
      const results: Record<string, QueueStats> = {}
      for (const q of queues) {
        try {
          transport.switchQueue(q)
          results[q] = await transport.getStats()
        } catch {
          // Skip failed queue
        }
      }
      // Restore active queue
      if (activeQueue) {
        transport.switchQueue(activeQueue)
      }
      if (mounted) {
        setStats(results)
      }
    }

    void refreshStats()
    const timer = setInterval(() => void refreshStats(), 5000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [queues, activeQueue, transport])

  // Global key bindings
  // oxlint-disable-next-line complexity -- keyboard handler with inherent branching
  useInput((input, key) => {
    // Ctrl+C always quits
    if (key.ctrl && input === "c") {
      exit()
      return
    }

    // q quits unless text input is active
    if (input === "q" && !inputActive) {
      exit()
      return
    }

    if (paletteOpen || helpOpen || flowOverlayId || inputActive) {
      return
    }

    if (input === "?") {
      setHelpOpen(true)
      return
    }
    if (key.ctrl && input === "k") {
      setPaletteOpen(true)
      return
    }
    if (key.tab && showSidebar) {
      setFocusPane(focusPane === "sidebar" ? "content" : "sidebar")
    }
    // Direct view shortcuts (only plain keys, not ctrl-modified)
    const canSwitchView =
      (focusPane === "content" || !showSidebar) && !selectedJobId && !key.ctrl
    if (canSwitchView) {
      if (input === "o") {
        setActiveView("overview")
      } else if (input === "j") {
        setActiveView("jobs")
      } else if (input === "d") {
        setActiveView("dead")
      }
    }
  })

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Connecting to server..." />
      </Box>
    )
  }

  if (queues.length === 0) {
    return (
      <Box padding={1}>
        <Text color="red">No queues found on the server.</Text>
      </Box>
    )
  }

  // Calculate pending job count per queue for badges
  const queueBadges: Record<string, number> = {}
  for (const q of queues) {
    const s = stats[q]
    if (s) {
      queueBadges[q] = s.pending + s.processing + s.delayed
    }
  }

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Header />
      <Box flexDirection="row" flexGrow={1}>
        {showSidebar && (
          <QueueSidebar
            queues={queues}
            badges={queueBadges}
            isFocused={
              !paletteOpen &&
              !helpOpen &&
              !flowOverlayId &&
              focusPane === "sidebar"
            }
          />
        )}
        <ContentPane
          isFocused={
            !paletteOpen &&
            !helpOpen &&
            !flowOverlayId &&
            (!showSidebar || focusPane === "content")
          }
        />
      </Box>
      {paletteOpen && (
        <DashboardCommandPalette isOpen={paletteOpen} onClose={closePalette} />
      )}
      {helpOpen && (
        <HelpOverlay isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      )}
      {flowOverlayId && (
        <FlowTreeOverlay
          flowId={flowOverlayId}
          isOpen={!!flowOverlayId}
          onClose={closeFlowTree}
        />
      )}
      <Footer />
    </Box>
  )
}

function Header() {
  const { activeQueue, activeView } = useDashboard()
  return (
    <Box paddingX={1} paddingY={0}>
      <Text bold color="#f97316">
        vorsteh-queue
      </Text>
      {activeQueue && (
        <>
          <Text color="gray"> › </Text>
          <Text bold>{activeQueue}</Text>
          <Text color="gray"> › </Text>
          <Text>{activeView}</Text>
        </>
      )}
      <Box flexGrow={1} />
      <Text color="green">● connected</Text>
    </Box>
  )
}

function Footer() {
  const { activeView, focusPane, selectedJobId, showSidebar } = useDashboard()
  const hints: string[] = []

  if (focusPane === "sidebar") {
    hints.push("↑↓ navigate", "↵ select", "Ctrl+K commands")
  } else if (selectedJobId) {
    hints.push(
      "c cancel",
      "r retry",
      "n run now",
      "x delete",
      "f flow tree",
      "y copy ID",
      "p copy payload",
      "Esc close"
    )
  } else {
    if (activeView === "jobs") {
      hints.push(
        "↑↓ row",
        "←→ status",
        "t time",
        "/ search",
        "↵ detail",
        "s sort",
        "Ctrl+D/U page"
      )
    } else if (activeView === "dead") {
      hints.push("↑↓ row", "↵ detail", "s sort")
    }
    hints.push("o/j/d view", "Ctrl+K commands")
  }

  if (showSidebar) {
    hints.push("Tab pane")
  }
  hints.push("Esc back", "? help", "q quit")

  return (
    <Box paddingX={1} paddingY={0}>
      <Text color="#9CA3AF">{hints.join(" │ ")}</Text>
    </Box>
  )
}
