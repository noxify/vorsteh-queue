import { Box, Text, useApp, useInput } from "ink"
import { Suspense } from "react"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router"

import type { Transport } from "../transport/types"
import { TransportProvider, useTransportContext } from "./context"
import { DetailView } from "./views/detail"
import { JobsView } from "./views/jobs"
import { StatsView } from "./views/stats"

interface AppProps {
  readonly transport: Transport
  readonly refreshInterval: number
}

/**
 * Root TUI application component.
 * Uses react-router MemoryRouter for view navigation.
 */
export function App({ transport, refreshInterval }: AppProps) {
  return (
    <TransportProvider transport={transport} refreshInterval={refreshInterval}>
      <MemoryRouter>
        <Box flexDirection="column" padding={1}>
          <Routes>
            <Route path="/" element={<StatsPage />} />
            <Route path="/jobs" element={<JobsPage />} />
            <Route path="/jobs/:jobId" element={<DetailPage />} />
          </Routes>
        </Box>
      </MemoryRouter>
    </TransportProvider>
  )
}

function StatsPage() {
  const { exit } = useApp()
  const navigate = useNavigate()
  const { refreshInterval } = useTransportContext()

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exit()
    }
    if (input === "j" || key.return) {
      void navigate("/jobs")
    }
  })

  return (
    <>
      <Header title="Queue Stats" />
      <Box flexDirection="column" marginTop={1}>
        <Suspense fallback={<Loading />}>
          <StatsView refreshInterval={refreshInterval} />
        </Suspense>
      </Box>
      <Footer hint="[j/↵] Jobs  [q] Quit" />
    </>
  )
}

function JobsPage() {
  const { exit } = useApp()
  const navigate = useNavigate()
  const { refreshInterval } = useTransportContext()

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exit()
    }
    if (key.escape) {
      void navigate("/")
    }
  })

  const handleSelectJob = (jobId: string) => {
    void navigate(`/jobs/${jobId}`)
  }

  return (
    <>
      <Header title="Jobs" />
      <Box flexDirection="column" marginTop={1}>
        <Suspense fallback={<Loading />}>
          <JobsView
            refreshInterval={refreshInterval}
            onSelectJob={handleSelectJob}
          />
        </Suspense>
      </Box>
      <Footer hint="[↑↓] Navigate  [←→] Filter  [↵] Detail  [n/p] Page  [Esc] Back  [q] Quit" />
    </>
  )
}

function DetailPage() {
  const { exit } = useApp()
  const navigate = useNavigate()

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      exit()
    }
    if (key.escape) {
      void navigate("/jobs")
    }
  })

  return (
    <>
      <Header title="Job Detail" />
      <Box flexDirection="column" marginTop={1}>
        <Suspense fallback={<Loading />}>
          <DetailView onBack={() => void navigate("/jobs")} />
        </Suspense>
      </Box>
      <Footer hint="[c] Cancel  [r] Retry  [n] Run Now  [d] Delete  [Esc] Back  [q] Quit" />
    </>
  )
}

function Header({ title }: { readonly title: string }) {
  return (
    <Box>
      <Text bold color="cyan">
        vorsteh-queue
      </Text>
      <Text color="gray"> › </Text>
      <Text bold>{title}</Text>
    </Box>
  )
}

function Footer({ hint }: { readonly hint: string }) {
  return (
    <Box marginTop={1}>
      <Text color="gray">{hint}</Text>
    </Box>
  )
}

function Loading() {
  return <Text color="gray">Loading...</Text>
}
