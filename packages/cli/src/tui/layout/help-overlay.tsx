import { Box, Text, useInput } from "ink"

import { useTheme } from "../components/ui/theme-provider"

interface HelpOverlayProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

const SECTIONS = [
  {
    title: "Navigation",
    keys: {
      Tab: "Switch focus between sidebar and content",
      o: "Switch to Overview",
      j: "Switch to Jobs",
      d: "Switch to Dead Letter",
      Esc: "Close drawer / go back",
      q: "Quit dashboard",
    },
  },
  {
    title: "Jobs View",
    keys: {
      "↑/↓": "Navigate rows",
      "←/→": "Cycle status filter",
      t: "Cycle time range (all / 1h / 24h / 7d / 30d)",
      "/": "Search by job name",
      s: "Cycle sort column",
      "Shift+S": "Toggle sort direction (asc/desc)",
      "↵": "Open job detail",
      "Ctrl+D": "Next page",
      "Ctrl+U": "Previous page",
    },
  },
  {
    title: "Job Detail",
    keys: {
      c: "Cancel job",
      r: "Retry job",
      n: "Run job now",
      x: "Delete job",
      y: "Copy job ID to clipboard",
      p: "Copy payload to clipboard",
      Esc: "Close detail drawer",
    },
  },
  {
    title: "Global",
    keys: {
      "Ctrl+K": "Open command palette",
      "?": "Toggle this help",
    },
  },
] as const

/**
 * Full-screen help overlay showing all keyboard shortcuts.
 */
export function HelpOverlay({ isOpen, onClose }: HelpOverlayProps) {
  const theme = useTheme()

  useInput((input, key) => {
    if (!isOpen) {
      return
    }
    if (key.escape || input === "?" || input === "q") {
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
          Keyboard Shortcuts
        </Text>
        <Box flexGrow={1} />
        <Text color={theme.colors.mutedForeground}>? or Esc to close</Text>
      </Box>

      {SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold color={theme.colors.foreground}>
            {section.title}
          </Text>
          {Object.entries(section.keys).map(([key, desc]) => (
            <Box key={key}>
              <Box width={12}>
                <Text bold color={theme.colors.primary}>
                  {key}
                </Text>
              </Box>
              <Text color={theme.colors.foreground}>{desc}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}
