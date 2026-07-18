import { Box } from "ink"

import { useDashboard } from "../context"
import { DeadView } from "../views/dead"
import { JobDetailDrawer } from "../views/detail"
import { JobsView } from "../views/jobs"
import { OverviewView } from "../views/overview"

interface ContentPaneProps {
  readonly isFocused: boolean
}

/**
 * Main content pane — renders the active view with an optional detail drawer.
 */
export function ContentPane({ isFocused }: ContentPaneProps) {
  const { activeView, activeQueue, selectedJobId } = useDashboard()

  if (!activeQueue) {
    return null
  }

  const drawerOpen = selectedJobId !== null
  const borderColor = isFocused ? "#f97316" : "gray"

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box
        flexDirection="column"
        flexGrow={1}
        borderStyle="single"
        borderColor={borderColor}
        paddingX={1}
        paddingY={0}
      >
        <ViewRouter view={activeView} isFocused={isFocused && !drawerOpen} />
      </Box>
      {drawerOpen && <JobDetailDrawer isFocused={isFocused} />}
    </Box>
  )
}

function ViewRouter({
  view,
  isFocused,
}: {
  readonly view: string
  readonly isFocused: boolean
}) {
  switch (view) {
    case "overview": {
      return <OverviewView isFocused={isFocused} />
    }
    case "jobs": {
      return <JobsView isFocused={isFocused} />
    }
    case "dead": {
      return <DeadView isFocused={isFocused} />
    }
    default: {
      return <OverviewView isFocused={isFocused} />
    }
  }
}
