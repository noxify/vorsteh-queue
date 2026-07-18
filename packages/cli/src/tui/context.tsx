import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import type { MultiQueueTransport } from "../transport/multi-queue"

/** Views available in the main content pane */
export type DashboardView = "overview" | "jobs" | "dead"

/** Which pane currently has keyboard focus */
export type FocusPane = "sidebar" | "content"

interface DashboardContextValue {
  readonly transport: MultiQueueTransport
  readonly refreshInterval: number
  readonly activeQueue: string
  readonly activeView: DashboardView
  readonly focusPane: FocusPane
  readonly selectedJobId: string | null
  readonly queues: readonly string[]
  readonly jobsFilterIndex: number
  readonly jobsPage: number
  readonly showSidebar: boolean
  readonly setActiveQueue: (queue: string) => void
  readonly setActiveView: (view: DashboardView) => void
  readonly setFocusPane: (pane: FocusPane) => void
  readonly selectJob: (jobId: string) => void
  readonly goBack: () => void
  readonly setQueues: (queues: readonly string[]) => void
  readonly setJobsFilterIndex: (index: number) => void
  readonly setJobsPage: (page: number) => void
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

interface DashboardProviderProps {
  readonly transport: MultiQueueTransport
  readonly refreshInterval: number
  readonly initialQueue?: string
  readonly showSidebar?: boolean
  readonly children: React.ReactNode
}

/**
 * Provides dashboard state (active queue, view, focus) and transport to all
 * TUI components.
 */
export function DashboardProvider({
  transport,
  refreshInterval,
  initialQueue,
  showSidebar = true,
  children,
}: DashboardProviderProps) {
  const [queues, setQueues] = useState<readonly string[]>(
    initialQueue ? [initialQueue] : []
  )
  // oxlint-disable-next-line react/hook-use-state -- wrapped by setActiveQueue callback
  const [activeQueue, _setActiveQueue] = useState(initialQueue ?? "")
  const [activeView, setActiveView] = useState<DashboardView>("overview")
  const [focusPane, setFocusPane] = useState<FocusPane>("sidebar")
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [jobsFilterIndex, setJobsFilterIndex] = useState(0)
  const [jobsPage, setJobsPage] = useState(0)

  const setActiveQueue = useCallback(
    (queue: string) => {
      _setActiveQueue(queue)
      transport.switchQueue(queue)
      setActiveView("overview")
      setSelectedJobId(null)
      setJobsFilterIndex(0)
      setJobsPage(0)
    },
    [transport]
  )

  const selectJob = useCallback((jobId: string) => {
    setSelectedJobId(jobId)
  }, [])

  const goBack = useCallback(() => {
    if (selectedJobId) {
      setSelectedJobId(null)
    } else if (activeView === "jobs" || activeView === "dead") {
      setActiveView("overview")
    }
  }, [selectedJobId, activeView])

  const value = useMemo(
    () => ({
      activeQueue,
      activeView,
      focusPane,
      goBack,
      jobsFilterIndex,
      jobsPage,
      queues,
      refreshInterval,
      selectJob,
      selectedJobId,
      setActiveQueue,
      setActiveView,
      setFocusPane,
      setJobsFilterIndex,
      setJobsPage,
      setQueues,
      showSidebar,
      transport,
    }),
    [
      activeQueue,
      activeView,
      focusPane,
      goBack,
      jobsFilterIndex,
      jobsPage,
      queues,
      refreshInterval,
      selectJob,
      selectedJobId,
      setActiveQueue,
      showSidebar,
      transport,
    ]
  )

  return <DashboardContext value={value}>{children}</DashboardContext>
}

/**
 * Access the dashboard state from any TUI component.
 *
 * @throws {Error} If used outside DashboardProvider
 */
export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider")
  }
  return ctx
}

/**
 * Convenience hook — access transport and refresh interval (backward compat).
 */
export function useTransportContext(): {
  transport: MultiQueueTransport
  refreshInterval: number
} {
  const { transport, refreshInterval } = useDashboard()
  return { refreshInterval, transport }
}
