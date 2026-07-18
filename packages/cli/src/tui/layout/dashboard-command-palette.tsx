import type { Command } from "../components/ui/command-palette"
import { CommandPalette } from "../components/ui/command-palette"
import { useDashboard } from "../context"

interface DashboardCommandPaletteProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

/**
 * Dashboard-specific Command Palette.
 * Provides commands for queue switching, view navigation, and job actions.
 */
export function DashboardCommandPalette({
  isOpen,
  onClose,
}: DashboardCommandPaletteProps) {
  const { queues, activeQueue, setActiveQueue, setActiveView } = useDashboard()

  const commands: Command[] = [
    // View commands
    {
      description: "Queue stats overview",
      group: "Views",
      id: "view:overview",
      label: "Overview",
      onSelect: () => setActiveView("overview"),
      shortcut: "o",
    },
    {
      description: "Browse and filter jobs",
      group: "Views",
      id: "view:jobs",
      label: "Jobs",
      onSelect: () => setActiveView("jobs"),
      shortcut: "j",
    },
    {
      description: "Dead-letter queue",
      group: "Views",
      id: "view:dead",
      label: "Dead Letter",
      onSelect: () => setActiveView("dead"),
      shortcut: "d",
    },
    // Queue commands
    ...queues.map((q) => ({
      description: q === activeQueue ? "(active)" : undefined,
      group: "Queues",
      id: `queue:${q}`,
      label: q,
      onSelect: () => setActiveQueue(q),
    })),
  ]

  return (
    <CommandPalette commands={commands} isOpen={isOpen} onClose={onClose} />
  )
}
